import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useLlmConfigStore } from '@/stores/llmConfigStore'
import { extractionService } from '@/services/extractionService'
import { LlmConfigDialog } from '@/components/settings/LlmConfigDialog'
import type { DocType } from '@/types'

function PdfIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M9 13h6M9 17h4" />
    </svg>
  )
}

function UploadIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export function UploadPage() {
  const navigate = useNavigate()
  const isConfigured = useLlmConfigStore((s) => s.isConfigured)
  const [docType, setDocType] = useState<DocType>('double_col')
  const [files, setFiles] = useState<File[]>([])
  const [showConfig, setShowConfig] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const MAX_FILES = 10

  // 合并新文件到已有列表（去重 + 上限过滤）
  const addFiles = useCallback((incoming: FileList | File[]) => {
    const pdfs = Array.from(incoming).filter((f) => {
      if (!f.name.toLowerCase().endsWith('.pdf')) {
        toast.error(`${f.name} 不是 PDF 文件，已跳过`)
        return false
      }
      return true
    })
    if (pdfs.length === 0) return

    setFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name))
      const unique = pdfs.filter((f) => {
        if (existingNames.has(f.name)) {
          toast.error(`${f.name} 已存在，已跳过`)
          return false
        }
        return true
      })
      const merged = [...prev, ...unique]
      if (merged.length > MAX_FILES) {
        toast.error(`最多支持 ${MAX_FILES} 个文件，已截断`)
        return merged.slice(0, MAX_FILES)
      }
      return merged
    })
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }, [addFiles])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files)
  }, [addFiles])

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const startProcessing = async () => {
    if (files.length === 0) return toast.error('请先选择 PDF 文件')
    if (!isConfigured()) {
      setShowConfig(true)
      return
    }
    setSubmitting(true)
    let failCount = 0
    const results = await Promise.allSettled(
      files.map((f) => extractionService.startExtraction(f, docType)),
    )
    for (const r of results) {
      if (r.status === 'rejected') {
        failCount++
        const msg = r.reason instanceof Error ? r.reason.message : '提交失败'
        toast.error(msg)
      }
    }
    setSubmitting(false)
    // 有成功的就跳转
    if (failCount < files.length) {
      navigate('/records')
    }
  }

  return (
    <div className="flex gap-5 items-start">
      {/* ── 左侧主内容区 ── */}
      <div className="flex-1 min-w-0 space-y-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: '#333333' }}>上传文献材料</h2>
          <p className="text-sm mt-0.5" style={{ color: '#666666' }}>支持电子版 PDF（临床研究论文 · 卫健委指南），最大 50 MB</p>
        </div>

        {/* 文件上传卡片 */}
        <div className="bg-white rounded-xl card-shadow border border-border overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border" style={{ background: '#F5F7FA' }}>
            <PdfIcon className="h-4 w-4" style={{ color: '#7B7CE5' } as React.CSSProperties} />
            <span className="text-sm font-medium" style={{ color: '#333333' }}>原始材料</span>
            {files.length > 0 && (
              <span className="ml-auto text-xs" style={{ color: '#666666' }}>已选择 {files.length}/{MAX_FILES} 个文件</span>
            )}
          </div>

          <div className="p-4 space-y-3">
            {/* 拖拽区 */}
            <div
              className="relative border-2 border-dashed rounded-xl text-center cursor-pointer transition-all"
              style={{
                borderColor: dragging ? '#7B7CE5' : files.length > 0 ? 'rgba(123,124,229,0.35)' : '#E2E5EC',
                background: dragging ? 'rgba(123,124,229,0.05)' : files.length > 0 ? 'rgba(123,124,229,0.03)' : 'transparent',
                padding: files.length > 0 ? '12px' : '32px 8px',
              }}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                onClick={(e) => e.stopPropagation()}
              />

              {files.length === 0 ? (
                <div className="space-y-2">
                  <div className="flex justify-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: 'rgba(123,124,229,0.1)' }}>
                      <UploadIcon className="h-6 w-6" style={{ color: '#7B7CE5' } as React.CSSProperties} />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#333333' }}>拖拽 PDF 文件到此处</p>
                    <p className="text-xs mt-1" style={{ color: '#666666' }}>
                      或{' '}
                      <span className="font-medium cursor-pointer" style={{ color: '#7B7CE5' }}>点击浏览文件</span>
                    </p>
                  </div>
                  <p className="text-xs" style={{ color: '#999' }}>仅支持电子版 PDF · 最多 {MAX_FILES} 个 · 单文件最大 50 MB</p>
                </div>
              ) : (
                <p className="text-xs" style={{ color: '#7B7CE5' }}>
                  继续拖拽或点击添加更多 PDF 文件
                </p>
              )}
            </div>

            {/* 文件列表 */}
            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((f, i) => (
                  <div
                    key={`${f.name}-${i}`}
                    className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: '#FEF2F2', color: '#F15F5F' }}>
                      <PdfIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium truncate" style={{ color: '#333333' }}>{f.name}</p>
                      <p className="text-xs" style={{ color: '#666666' }}>{formatSize(f.size)}</p>
                    </div>
                    {!submitting && (
                      <button
                        onClick={() => handleRemoveFile(i)}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors"
                        style={{ color: '#999' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#F15F5F' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#999' }}
                        title="移除文件"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}

                {/* 追加按钮 */}
                {!submitting && files.length < MAX_FILES && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2 text-xs text-center rounded-lg border border-dashed transition-colors"
                    style={{ color: '#666666', borderColor: '#E2E5EC' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#7B7CE5'; e.currentTarget.style.borderColor = 'rgba(123,124,229,0.4)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#666666'; e.currentTarget.style.borderColor = '#E2E5EC' }}
                  >
                    点击继续添加文件
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* PDF 布局选择 */}
        <div className="bg-white rounded-xl card-shadow border border-border overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border" style={{ background: '#F5F7FA' }}>
            <svg className="h-4 w-4" style={{ color: '#7B7CE5' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="18" /><rect x="14" y="3" width="7" height="18" />
            </svg>
            <span className="text-sm font-medium" style={{ color: '#333333' }}>PDF 布局</span>
          </div>
          <div className="p-4 flex gap-3">
            {([
              { value: 'single_col', label: '单栏排版', desc: '普通文档，单列文本' },
              { value: 'double_col', label: '双栏排版', desc: '学术论文，两列文本' },
            ] as { value: DocType; label: string; desc: string }[]).map((opt) => {
              const active = docType === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => setDocType(opt.value)}
                  className="flex-1 flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all"
                  style={{
                    borderColor: active ? '#7B7CE5' : '#E2E5EC',
                    background: active ? 'rgba(123,124,229,0.05)' : 'transparent',
                  }}
                >
                  <div
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all"
                    style={{
                      borderColor: active ? '#7B7CE5' : '#C4C7D0',
                      background: active ? '#7B7CE5' : 'transparent',
                    }}
                  >
                    {active && <div className="h-2 w-2 rounded-full bg-white" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: active ? '#7B7CE5' : '#333333' }}>{opt.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#666666' }}>{opt.desc}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── 右侧面板 ── */}
      <div className="w-72 shrink-0 space-y-4 pt-8">
        {/* 智能提取引擎卡 */}
        <div className="bg-white rounded-xl card-shadow border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border" style={{ background: 'linear-gradient(135deg, rgba(123,124,229,0.08) 0%, rgba(54,179,179,0.08) 100%)' }}>
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-md flex items-center justify-center" style={{ background: '#36B3B3' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="white" stroke="none">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" opacity="0.7" />
                  <path d="M2 12l10 5 10-5" opacity="0.5" />
                </svg>
              </div>
              <span className="text-sm font-semibold" style={{ color: '#333333' }}>智能提取引擎</span>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-xs leading-relaxed" style={{ color: '#666666' }}>
              基于 LLM 端到端将 PDF 转化为 14 字段结构化知识，支持论文 + 卫健委指南双管线。
            </p>
            <div className="space-y-2">
              {[
                { label: '解析引擎', value: 'PyMuPDF4LLM' },
                { label: '输出格式', value: 'JSON + Excel' },
                { label: '字段数量', value: '14 字段' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between text-xs">
                  <span style={{ color: '#666666' }}>{item.label}</span>
                  <span className="font-medium" style={{ color: '#333333' }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 使用提示卡 */}
        <div className="bg-white rounded-xl card-shadow border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border" style={{ background: '#F5F7FA' }}>
            <span className="text-xs font-medium uppercase tracking-wide" style={{ color: '#666666' }}>使用提示</span>
          </div>
          <div className="p-4 space-y-2.5">
            {[
              '仅支持电子版 PDF，不支持扫描件',
              '双栏 PDF 请选择「双栏排版」',
              '首次使用请先配置 LLM API Key',
              '提取完成后可在记录页审核',
            ].map((tip, i) => (
              <div key={i} className="flex gap-2 text-xs" style={{ color: '#666666' }}>
                <span
                  className="shrink-0 flex h-4 w-4 items-center justify-center rounded-full font-bold text-[10px]"
                  style={{ background: 'rgba(123,124,229,0.12)', color: '#7B7CE5' }}
                >
                  {i + 1}
                </span>
                <span className="leading-relaxed">{tip}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 进入解析按钮 — 主品牌色 */}
        <button
          onClick={startProcessing}
          disabled={files.length === 0 || submitting}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all"
          style={files.length > 0 && !submitting ? {
            background: 'linear-gradient(90deg, #7B7CE5 0%, #6465D4 100%)',
            color: '#fff',
            boxShadow: '0 4px 14px rgba(123,124,229,0.35)',
          } : {
            background: '#EEF0F6',
            color: '#999',
            cursor: 'not-allowed',
          }}
          onMouseEnter={(e) => {
            if (files.length > 0 && !submitting) e.currentTarget.style.boxShadow = '0 6px 20px rgba(123,124,229,0.45)'
          }}
          onMouseLeave={(e) => {
            if (files.length > 0 && !submitting) e.currentTarget.style.boxShadow = '0 4px 14px rgba(123,124,229,0.35)'
          }}
        >
          {submitting ? (
            <>
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              提交中...
            </>
          ) : (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              {files.length > 0 ? `进入解析与提取（${files.length}篇）` : '请先选择文件'}
            </>
          )}
        </button>
      </div>

      <LlmConfigDialog open={showConfig} onOpenChange={setShowConfig} />
    </div>
  )
}
