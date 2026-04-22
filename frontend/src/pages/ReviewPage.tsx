import { useNavigate, useParams } from 'react-router-dom'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useDocumentsStore } from '@/stores/documentsStore'
import { useUiStore } from '@/stores/uiStore'
import type { ExtractedFields } from '@/types'

// 字段分组定义
const FIELD_GROUPS = [
  {
    label: '基本信息',
    fields: ['title', 'doc_category', 'received_date'] as const,
  },
  {
    label: '标签与分类',
    fields: ['keywords', 'departments', 'classification'] as const,
  },
  {
    label: '置信度',
    fields: ['authority_level', 'authority_basis'] as const,
  },
]

const FIELD_LABELS: Record<string, string> = {
  title: '文献标题',
  doc_category: '文献类型',
  received_date: '收稿年月',
  keywords: '关键词',
  departments: '就诊科室',
  authority_level: '置信度',
  authority_basis: '置信度依据',
  classification: '分类体系',
}

export function ReviewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const doc = useDocumentsStore((s) => s.documents.find((d) => d.id === id))
  const updateDocument = useDocumentsStore((s) => s.updateDocument)
  const highlightSpan = useUiStore((s) => s.highlightSpan)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
    Object.fromEntries(FIELD_GROUPS.map((g) => [g.label, true])),
  )
  const [editedFields, setEditedFields] = useState<ExtractedFields | null>(null)

  if (!doc) {
    return <div className="text-center py-20 text-muted-foreground">文档不存在</div>
  }

  const fields = editedFields ?? doc.fields
  const isLowConfidence = doc.extraction_confidence < 0.3

  const handleSave = () => {
    if (editedFields) {
      updateDocument(doc.id, {
        fields: editedFields,
        status: 'reviewed',
        reviewed_at: Date.now(),
      })
    } else {
      updateDocument(doc.id, {
        status: 'reviewed',
        reviewed_at: Date.now(),
      })
    }
    toast.success('已保存')
    navigate('/records')
  }

  const updateField = (key: string, value: unknown) => {
    setEditedFields((prev) => ({ ...(prev ?? doc.fields), [key]: value }))
  }

  return (
    <div className="space-y-4">
      {isLowConfidence && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-md text-sm">
          AI 提取置信度极低（{(doc.extraction_confidence * 100).toFixed(0)}%），建议人工逐字段核对
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{doc.filename}</h2>
          <p className="text-sm text-muted-foreground">
            {doc.doc_type === 'single_col' ? '单栏' : '双栏'} · 置信度 {(doc.extraction_confidence * 100).toFixed(0)}%
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/records')}>取消</Button>
          <Button onClick={handleSave}>保存并完成</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 h-[calc(100vh-200px)]">
        {/* 左：Markdown */}
        <Card className="p-4 overflow-y-auto">
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {doc.markdown}
            </ReactMarkdown>
          </div>
        </Card>

        {/* 右：字段表单 */}
        <div className="overflow-y-auto space-y-2">
          {FIELD_GROUPS.map((group) => (
            <Collapsible
              key={group.label}
              open={openGroups[group.label]}
              onOpenChange={(open) => setOpenGroups((prev) => ({ ...prev, [group.label]: open }))}
            >
              <CollapsibleTrigger className="flex w-full items-center justify-between p-3 bg-muted rounded-md text-sm font-medium">
                {group.label}
                <span className="text-muted-foreground">{openGroups[group.label] ? '−' : '+'}</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 p-3">
                {group.fields.map((fieldName) => (
                  <FieldRow
                    key={fieldName}
                    name={fieldName}
                    label={FIELD_LABELS[fieldName] || fieldName}
                    value={fields[fieldName as keyof ExtractedFields]}
                    snippet={doc.source_snippets[fieldName]}
                    highlight={highlightSpan}
                    onChange={(v) => updateField(fieldName, v)}
                  />
                ))}
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </div>
    </div>
  )
}

interface FieldRowProps {
  name: string
  label: string
  value: unknown
  snippet?: string
  highlight: string | null
  onChange: (value: unknown) => void
}

function FieldRow({ name, label, value, snippet, highlight, onChange }: FieldRowProps) {
  const isHighlighted = highlight === name
  const isArr = Array.isArray(value)
  const isObj = typeof value === 'object' && value !== null && !isArr

  return (
    <div className={`rounded-md border p-3 ${isHighlighted ? 'border-yellow-400 bg-yellow-50' : 'border-border'}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium">{label}</span>
        {snippet && (
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="secondary" className="text-xs cursor-help">溯源</Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-xs">{snippet}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      {isArr ? (
        <Input
          value={(value as string[]).join('；')}
          onChange={(e) => onChange(e.target.value.split('；').filter(Boolean))}
          className="text-sm"
        />
      ) : isObj ? (
        <Textarea
          value={JSON.stringify(value, null, 2)}
          onChange={(e) => {
            try { onChange(JSON.parse(e.target.value)) } catch { /* 编辑中 */ }
          }}
          className="text-sm font-mono"
          rows={3}
        />
      ) : (
        <Input
          value={value == null ? '' : String(value)}
          onChange={(e) => onChange(e.target.value || null)}
          className="text-sm"
        />
      )}
    </div>
  )
}
