import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useDocumentsStore } from '@/stores/documentsStore'
import { exportService } from '@/services/exportService'
import { storageService } from '@/services/storageService'
import type { DocStatus } from '@/types'

const STATUS_CONFIG: Record<DocStatus, { label: string; color: string; bg: string; border: string; dot: string; loading?: boolean }> = {
  parsing:        { label: '解析中',  color: '#7B7CE5', bg: 'rgba(123,124,229,0.08)', border: 'rgba(123,124,229,0.2)', dot: '#7B7CE5', loading: true },
  extracting:     { label: '提取中',  color: '#36B3B3', bg: 'rgba(54,179,179,0.08)',  border: 'rgba(54,179,179,0.2)',  dot: '#36B3B3', loading: true },
  pending_review: { label: '待审核',  color: '#F5A623', bg: 'rgba(245,166,35,0.08)',  border: 'rgba(245,166,35,0.2)',  dot: '#F5A623' },
  reviewed:       { label: '已入库',  color: '#3DBE8B', bg: 'rgba(61,190,139,0.08)',  border: 'rgba(61,190,139,0.2)',  dot: '#3DBE8B' },
  error:          { label: '错误',    color: '#F15F5F', bg: 'rgba(241,95,95,0.08)',   border: 'rgba(241,95,95,0.2)',   dot: '#F15F5F' },
}

type Filter = 'all' | 'pending' | 'reviewed'
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',      label: '全部' },
  { key: 'pending',  label: '待审核' },
  { key: 'reviewed', label: '已入库' },
]

function PdfIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M9 13h6M9 17h4" />
    </svg>
  )
}

export function RecordsPage() {
  const navigate = useNavigate()
  const documents = useDocumentsStore((s) => s.documents)
  const removeDocument = useDocumentsStore((s) => s.removeDocument)
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const filtered = documents.filter((doc) => {
    if (filter === 'pending') return doc.status === 'pending_review'
    if (filter === 'reviewed') return doc.status === 'reviewed'
    return true
  })

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map((d) => d.id)))
  }

  const handleExport = () => {
    const toExport = documents.filter((d) => selected.has(d.id))
    if (toExport.length === 0) { toast.error('请先选择要导出的记录'); return }
    exportService.exportToExcel(toExport)
    toast.success(`已导出 ${toExport.length} 条记录`)
  }

  const handleDelete = async (id: string) => {
    removeDocument(id)
    await storageService.deletePdfBlob(id).catch(() => {})
    setSelected((prev) => { const next = new Set(prev); next.delete(id); return next })
    toast.success('已删除')
  }

  const pendingCount    = documents.filter((d) => d.status === 'pending_review').length
  const reviewedCount   = documents.filter((d) => d.status === 'reviewed').length
  const processingCount = documents.filter((d) => d.status === 'parsing' || d.status === 'extracting').length

  return (
    <div className="space-y-5">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: '#333333' }}>文献记录</h2>
          <p className="text-sm mt-0.5" style={{ color: '#666666' }}>共 {documents.length} 条记录</p>
        </div>
        <button
          onClick={handleExport}
          disabled={selected.size === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={selected.size > 0
            ? { background: 'linear-gradient(90deg, #7B7CE5 0%, #6465D4 100%)', color: '#fff', boxShadow: '0 4px 12px rgba(123,124,229,0.3)' }
            : { background: '#EEF0F6', color: '#999', cursor: 'not-allowed' }
          }
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          导出 Excel {selected.size > 0 && `(${selected.size})`}
        </button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: '总文献数',  value: documents.length,  color: '#333333', bg: '#fff',                      border: '#E2E5EC' },
          { label: '处理中',    value: processingCount,   color: '#7B7CE5', bg: 'rgba(123,124,229,0.06)',     border: 'rgba(123,124,229,0.2)' },
          { label: '待审核',    value: pendingCount,      color: '#F5A623', bg: 'rgba(245,166,35,0.06)',      border: 'rgba(245,166,35,0.2)' },
          { label: '已入库',    value: reviewedCount,     color: '#3DBE8B', bg: 'rgba(61,190,139,0.06)',      border: 'rgba(61,190,139,0.2)' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl px-4 py-3 card-shadow" style={{ background: stat.bg, border: `1px solid ${stat.border}` }}>
            <p className="text-xs" style={{ color: '#666666' }}>{stat.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* 列表主卡片 */}
      <div className="bg-white rounded-xl card-shadow border border-border overflow-hidden">
        {/* 工具栏 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border" style={{ background: '#F5F7FA' }}>
          <Checkbox
            checked={selected.size === filtered.length && filtered.length > 0}
            onCheckedChange={toggleAll}
          />
          {/* 过滤 Tabs */}
          <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: '#ECEEF4' }}>
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="px-3 py-1 rounded-md text-xs font-medium transition-all"
                style={filter === f.key
                  ? { background: '#fff', color: '#7B7CE5', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                  : { color: '#666666' }
                }
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          {selected.size > 0 && (
            <span className="text-xs" style={{ color: '#666666' }}>已选 {selected.size} 项</span>
          )}
        </div>

        {/* 列表内容 */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-12 w-12 rounded-full flex items-center justify-center mb-3" style={{ background: '#EEF0F6' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <p className="text-sm font-medium" style={{ color: '#333333' }}>暂无文献记录</p>
            <p className="text-xs mt-1" style={{ color: '#666666' }}>上传 PDF 后记录将显示在这里</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((doc, idx) => {
              const status = STATUS_CONFIG[doc.status]
              const isSelected = selected.has(doc.id)
              return (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors cursor-default"
                  style={{ background: isSelected ? 'rgba(123,124,229,0.04)' : 'transparent' }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#FAFBFF' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = isSelected ? 'rgba(123,124,229,0.04)' : 'transparent' }}
                >
                  {/* 序号 / 选择框 */}
                  <div className="w-8 shrink-0 flex items-center justify-center">
                    {isSelected ? (
                      <Checkbox checked onCheckedChange={() => toggleSelect(doc.id)} />
                    ) : (
                      <span
                        className="text-xs w-8 text-center cursor-pointer select-none"
                        style={{ color: '#C4C7D0' }}
                        onClick={() => toggleSelect(doc.id)}
                      >
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                    )}
                  </div>

                  {/* PDF 图标 */}
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: '#FEF2F2', color: '#F15F5F' }}>
                    <PdfIcon />
                  </div>

                  {/* 文件名 + 元信息 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: '#333333' }}>{doc.filename}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs" style={{ color: '#666666' }}>{doc.doc_type === 'single_col' ? '单栏' : '双栏'}</span>
                      <span style={{ color: '#D0D3DB' }}>·</span>
                      <span className="text-xs" style={{ color: '#666666' }}>
                        {new Date(doc.uploaded_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {/* 置信度进度条 */}
                  <div className="w-20 text-right shrink-0">
                    {(doc.status === 'reviewed' || doc.status === 'pending_review') ? (
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs font-medium" style={{ color: '#333333' }}>
                          {(doc.extraction_confidence * 100).toFixed(0)}%
                        </span>
                        <div className="h-1 w-16 rounded-full overflow-hidden" style={{ background: '#EEF0F6' }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${doc.extraction_confidence * 100}%`,
                              background: doc.extraction_confidence >= 0.7 ? '#3DBE8B'
                                : doc.extraction_confidence >= 0.4 ? '#F5A623' : '#F15F5F',
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs" style={{ color: '#C4C7D0' }}>—</span>
                    )}
                  </div>

                  {/* 状态 Badge */}
                  <div className="w-20 shrink-0 flex justify-center">
                    {doc.status === 'error' && doc.error_message ? (
                      <Tooltip>
                        <TooltipTrigger>
                          <div
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border cursor-help"
                            style={{ color: status.color, background: status.bg, borderColor: status.border }}
                          >
                            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: status.dot }} />
                            {status.label}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-xs leading-relaxed">{doc.error_message}</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <div
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
                        style={{ color: status.color, background: status.bg, borderColor: status.border }}
                      >
                        {status.loading ? (
                          <span className="inline-block h-2 w-2 animate-spin rounded-full border border-current border-t-transparent" />
                        ) : (
                          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: status.dot }} />
                        )}
                        {status.label}
                      </div>
                    )}
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-1 shrink-0">
                    {(doc.status === 'pending_review' || doc.status === 'reviewed') && (
                      <button
                        onClick={() => navigate(`/review/${doc.id}`)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        style={{ color: '#7B7CE5', background: 'rgba(123,124,229,0.08)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(123,124,229,0.15)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(123,124,229,0.08)' }}
                      >
                        查看
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      style={{ color: '#F15F5F', background: 'rgba(241,95,95,0.08)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(241,95,95,0.15)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(241,95,95,0.08)' }}
                    >
                      移除
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 底部统计 */}
        {filtered.length > 0 && (
          <div className="px-4 py-2.5 border-t border-border flex items-center justify-between" style={{ background: '#F5F7FA' }}>
            <span className="text-xs" style={{ color: '#666666' }}>共 {filtered.length} 条</span>
            {filter !== 'all' && (
              <span className="text-xs" style={{ color: '#666666' }}>
                已筛选：{FILTERS.find(f => f.key === filter)?.label}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
