import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useDocumentsStore } from '@/stores/documentsStore'
import { exportService } from '@/services/exportService'
import { storageService } from '@/services/storageService'
import type { DocStatus } from '@/types'

const STATUS_MAP: Record<DocStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  parsing: { label: '解析中', variant: 'secondary' },
  extracting: { label: '提取中', variant: 'secondary' },
  pending_review: { label: '待审核', variant: 'outline' },
  reviewed: { label: '已入库', variant: 'default' },
  error: { label: '错误', variant: 'destructive' },
}

type Filter = 'all' | 'pending' | 'reviewed'

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
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map((d) => d.id)))
    }
  }

  const handleExport = () => {
    const toExport = documents.filter((d) => selected.has(d.id))
    if (toExport.length === 0) {
      toast.error('请先选择要导出的记录')
      return
    }
    exportService.exportToExcel(toExport)
    toast.success(`已导出 ${toExport.length} 条记录`)
  }

  const handleDelete = async (id: string) => {
    removeDocument(id)
    await storageService.deletePdfBlob(id).catch(() => {})
    setSelected((prev) => { const next = new Set(prev); next.delete(id); return next })
    toast.success('已删除')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">记录</h2>
        <Button onClick={handleExport} disabled={selected.size === 0}>
          导出 Excel ({selected.size})
        </Button>
      </div>

      <div className="flex gap-2">
        {(['all', 'pending', 'reviewed'] as Filter[]).map((f) => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? '全部' : f === 'pending' ? '待审核' : '已入库'}
          </Button>
        ))}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} />
              </TableHead>
              <TableHead>文件名</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>置信度</TableHead>
              <TableHead>时间</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  暂无记录
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((doc) => {
                const status = STATUS_MAP[doc.status]
                return (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <Checkbox checked={selected.has(doc.id)} onCheckedChange={() => toggleSelect(doc.id)} />
                    </TableCell>
                    <TableCell className="font-medium">{doc.filename}</TableCell>
                    <TableCell>{doc.doc_type === 'single_col' ? '单栏' : '双栏'}</TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell>{(doc.extraction_confidence * 100).toFixed(0)}%</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(doc.uploaded_at).toLocaleString('zh-CN')}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {(doc.status === 'pending_review' || doc.status === 'reviewed') && (
                          <Button size="sm" variant="ghost" onClick={() => navigate(`/review/${doc.id}`)}>
                            查看
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(doc.id)}>
                          删除
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
