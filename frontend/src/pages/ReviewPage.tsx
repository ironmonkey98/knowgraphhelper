import { useNavigate, useParams } from 'react-router-dom'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useDocumentsStore } from '@/stores/documentsStore'
import { useUiStore } from '@/stores/uiStore'
import type { ExtractedFields } from '@/types'

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
    label: '置信度信息',
    fields: ['authority_level', 'authority_basis'] as const,
  },
]

const FIELD_LABELS: Record<string, string> = {
  title: '文献标题',
  doc_category: '文献类型',
  received_date: '收稿年月',
  keywords: '关键词',
  departments: '就诊科室',
  authority_level: '置信度等级',
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
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="h-14 w-14 rounded-full flex items-center justify-center mb-4" style={{ background: '#EEF0F6' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
        <p className="text-sm font-medium" style={{ color: '#333333' }}>文档不存在</p>
        <p className="text-xs mt-1" style={{ color: '#666666' }}>请从记录页重新进入</p>
        <button
          onClick={() => navigate('/records')}
          className="mt-4 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ color: '#7B7CE5', background: 'rgba(123,124,229,0.08)' }}
        >
          返回记录
        </button>
      </div>
    )
  }

  const fields = editedFields ?? doc.fields
  const isLowConfidence = doc.extraction_confidence < 0.3
  const confidencePct = (doc.extraction_confidence * 100).toFixed(0)
  const confidenceColor = doc.extraction_confidence >= 0.7 ? '#3DBE8B' : doc.extraction_confidence >= 0.4 ? '#F5A623' : '#F15F5F'

  const handleSave = () => {
    if (editedFields) {
      updateDocument(doc.id, { fields: editedFields, status: 'reviewed', reviewed_at: Date.now() })
    } else {
      updateDocument(doc.id, { status: 'reviewed', reviewed_at: Date.now() })
    }
    toast.success('已保存并入库')
    navigate('/records')
  }

  const updateField = (key: string, value: unknown) => {
    setEditedFields((prev) => ({ ...(prev ?? doc.fields), [key]: value }))
  }

  return (
    <div className="space-y-4">
      {/* 低置信度警告 */}
      {isLowConfidence && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm border" style={{ background: 'rgba(241,95,95,0.06)', borderColor: 'rgba(241,95,95,0.25)', color: '#c94444' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          AI 提取置信度极低（{confidencePct}%），建议逐字段人工核对后再入库
        </div>
      )}

      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/records')}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors"
            style={{ color: '#666666', background: 'transparent' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#EEF0F6' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="min-w-0">
            <h2 className="text-base font-semibold truncate" style={{ color: '#333333' }}>{doc.filename}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs" style={{ color: '#666666' }}>{doc.doc_type === 'single_col' ? '单栏' : '双栏'}</span>
              <span style={{ color: '#D0D3DB' }}>·</span>
              <span className="text-xs" style={{ color: '#666666' }}>置信度 {confidencePct}%</span>
              <div className="h-1 w-20 rounded-full overflow-hidden" style={{ background: '#EEF0F6' }}>
                <div className="h-full rounded-full" style={{ width: `${doc.extraction_confidence * 100}%`, background: confidenceColor }} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => navigate('/records')}
            className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
            style={{ color: '#666666', borderColor: '#E2E5EC', background: 'transparent' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#F5F7FA' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{ background: 'linear-gradient(90deg, #7B7CE5 0%, #6465D4 100%)', color: '#fff', boxShadow: '0 4px 12px rgba(123,124,229,0.3)' }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 6px 16px rgba(123,124,229,0.4)' }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(123,124,229,0.3)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            保存并入库
          </button>
        </div>
      </div>

      {/* 双栏主体 */}
      <div className="grid grid-cols-2 gap-4" style={{ height: 'calc(100vh - 200px)' }}>
        {/* 左：原始 Markdown */}
        <div className="bg-white rounded-xl card-shadow border border-border overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border shrink-0" style={{ background: '#F5F7FA' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span className="text-xs font-medium" style={{ color: '#666666' }}>原始文档 (Markdown)</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.markdown}</ReactMarkdown>
            </div>
          </div>
        </div>

        {/* 右：字段表单 */}
        <div className="overflow-y-auto space-y-2">
          {FIELD_GROUPS.map((group) => (
            <Collapsible
              key={group.label}
              open={openGroups[group.label]}
              onOpenChange={(open) => setOpenGroups((prev) => ({ ...prev, [group.label]: open }))}
            >
              <CollapsibleTrigger
                className="flex w-full items-center justify-between px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors"
                style={{ background: '#fff', borderColor: '#E2E5EC', color: '#333333' }}
              >
                <span>{group.label}</span>
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2"
                  className={`transition-transform ${openGroups[group.label] ? 'rotate-180' : ''}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-1 space-y-2 px-1">
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
    <div
      className="bg-white rounded-xl border px-3 py-3 transition-all"
      style={{
        borderColor: isHighlighted ? '#F5A623' : '#E2E5EC',
        background: isHighlighted ? 'rgba(245,166,35,0.04)' : '#fff',
        boxShadow: isHighlighted ? '0 0 0 2px rgba(245,166,35,0.15)' : 'none',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#666666' }}>{label}</span>
        {snippet && (
          <Tooltip>
            <TooltipTrigger>
              <div
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs cursor-help"
                style={{ background: 'rgba(123,124,229,0.1)', color: '#7B7CE5' }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                溯源
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-xs leading-relaxed">{snippet}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      {isArr ? (
        <Input
          value={(value as string[]).join('；')}
          onChange={(e) => onChange(e.target.value.split('；').filter(Boolean))}
          className="text-sm h-8"
        />
      ) : isObj ? (
        <Textarea
          value={JSON.stringify(value, null, 2)}
          onChange={(e) => { try { onChange(JSON.parse(e.target.value)) } catch { /* 编辑中 */ } }}
          className="text-xs font-mono resize-none"
          rows={3}
        />
      ) : (
        <Input
          value={value == null ? '' : String(value)}
          onChange={(e) => onChange(e.target.value || null)}
          className="text-sm h-8"
        />
      )}
    </div>
  )
}
