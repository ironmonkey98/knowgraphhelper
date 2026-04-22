import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { useLlmConfigStore } from '@/stores/llmConfigStore'
import { useDocumentsStore } from '@/stores/documentsStore'
import { useUiStore } from '@/stores/uiStore'
import { parseService } from '@/services/parseService'
import { llmService } from '@/services/llmService'
import { storageService } from '@/services/storageService'
import { PROMPT_VERSION } from '@/prompts/paperPrompt'
import { LlmResponseSchema } from '@/schemas/llmResponse'
import { LlmConfigDialog } from '@/components/settings/LlmConfigDialog'
import { PromptConfigDialog } from '@/components/settings/PromptConfigDialog'
import { usePromptStore } from '@/stores/promptStore'
import type { DocType, Document, ExtractedFields } from '@/types'
import type { ZodError } from 'zod'

export function UploadPage() {
  const navigate = useNavigate()
  const config = useLlmConfigStore((s) => s.config)
  const isConfigured = useLlmConfigStore((s) => s.isConfigured)
  const addDocument = useDocumentsStore((s) => s.addDocument)
  const updateDocument = useDocumentsStore((s) => s.updateDocument)
  const setCurrentDocumentId = useUiStore((s) => s.setCurrentDocumentId)
  const [docType, setDocType] = useState<DocType>('single_col')
  const [file, setFile] = useState<File | null>(null)
  const [processing, setProcessing] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [showPromptConfig, setShowPromptConfig] = useState(false)
  const getEffectivePrompt = usePromptStore((s) => s.getEffectivePrompt)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const dropped = e.dataTransfer.files[0]
    if (dropped?.name.toLowerCase().endsWith('.pdf')) {
      setFile(dropped)
    } else {
      toast.error('仅支持 PDF 文件')
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) setFile(selected)
  }, [])

  const startProcessing = async () => {
    if (!file) return toast.error('请先选择 PDF 文件')
    if (!isConfigured()) {
      setShowConfig(true)
      return
    }

    setProcessing(true)
    const docId = crypto.randomUUID()

    try {
      // 1. 创建 Document（parsing 状态）
      const doc: Document = {
        id: docId,
        filename: file.name,
        doc_type: docType,
        status: 'parsing',
        uploaded_at: Date.now(),
        markdown: '',
        fields: {} as ExtractedFields,
        source_snippets: {},
        extraction_confidence: 0,
        prompt_version: PROMPT_VERSION,
      }
      addDocument(doc)

      // 2. 存 PDF Blob 到 IndexedDB
      await storageService.savePdfBlob(docId, new Blob([await file.arrayBuffer()], { type: 'application/pdf' }))

      // 3. 解析 PDF → Markdown
      const parsed = await parseService.parsePdf(file, docType)
      updateDocument(docId, {
        status: 'extracting',
        markdown: parsed.markdown,
        page_count: parsed.page_count,
        parse_time_ms: parsed.parse_time_ms,
      })

      // 4. LLM 提取
      const llmConfig = config!
      const systemPrompt = getEffectivePrompt()
      const layoutHint = docType === 'double_col' ? '（注意：此 PDF 为双栏排版，内容可能存在跨栏拼接，请仔细识别段落归属）' : ''
      const userPrompt = `请从以下医学文献 Markdown 中提取字段${layoutHint}\n\n[Markdown]\n${parsed.markdown}`

      let result = await llmService.chat({
        config: llmConfig,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      })

      // 5. Zod 校验
      const validation = LlmResponseSchema.safeParse(result)
      if (!validation.success) {
        // 重试一次，带错误反馈
        const errors = formatZodErrors(validation.error)
        result = await llmService.chat({
          config: llmConfig,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
            { role: 'assistant', content: JSON.stringify(result) },
            {
              role: 'user',
              content: `你上次输出不符合 schema，错误：${errors}\n请严格按照 JSON Schema 重新输出（不含解释文字）。原输入不变。`,
            },
          ],
          response_format: { type: 'json_object' },
        })

        const retryValidation = LlmResponseSchema.safeParse(result)
        if (!retryValidation.success) {
          throw new Error(`字段校验失败：${formatZodErrors(retryValidation.error)}`)
        }
        result = retryValidation.data
      } else {
        result = validation.data
      }

      // 6. 保存结果
      const llmData = result as { fields: ExtractedFields; source_snippets: Record<string, string>; extraction_confidence: number }
      updateDocument(docId, {
        status: 'pending_review',
        fields: llmData.fields,
        source_snippets: llmData.source_snippets,
        extraction_confidence: llmData.extraction_confidence,
      })

      setCurrentDocumentId(docId)
      navigate(`/review/${docId}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : '处理失败'
      updateDocument(docId, { status: 'error', error_message: message })
      if (message === 'AUTH_FAILED') {
        toast.error('API Key 无效，请重新配置')
        setShowConfig(true)
      } else {
        toast.error(message)
      }
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">上传文献</h2>
        <Button variant="outline" size="sm" onClick={() => setShowConfig(true)}>
          LLM 配置
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowPromptConfig(true)}>
          提示词设置
        </Button>
      </div>

      <Card className="p-6">
        <div
          className="border-2 border-dashed border-border rounded-lg p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleFileSelect}
            onClick={(e) => e.stopPropagation()}
          />
          {file ? (
            <div>
              <p className="text-foreground font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          ) : (
            <div>
              <p className="text-foreground">拖拽 PDF 文件到此处，或点击选择</p>
              <p className="text-sm text-muted-foreground mt-2">支持电子版 PDF，最大 50MB</p>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-sm font-medium mb-3">PDF 布局</h3>
        <RadioGroup value={docType} onValueChange={(v) => setDocType(v as DocType)}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="single_col" id="single_col" />
            <Label htmlFor="single_col">单栏</Label>
          </div>
          <div className="flex items-center space-x-2 mt-2">
            <RadioGroupItem value="double_col" id="double_col" />
            <Label htmlFor="double_col">双栏</Label>
          </div>
        </RadioGroup>
      </Card>

      <Button
        className="w-full"
        size="lg"
        disabled={!file || processing}
        onClick={startProcessing}
      >
        {processing ? '处理中...' : '开始解析与提取'}
      </Button>

      <LlmConfigDialog open={showConfig} onOpenChange={setShowConfig} />
      <PromptConfigDialog open={showPromptConfig} onOpenChange={setShowPromptConfig} />
    </div>
  )
}

function formatZodErrors(error: ZodError): string {
  const flattened = error.flatten()
  const fieldErrors = flattened.fieldErrors
  return JSON.stringify(fieldErrors)
}
