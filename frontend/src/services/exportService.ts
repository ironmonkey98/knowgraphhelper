import * as XLSX from 'xlsx'
import type { Document } from '@/types'

const FIELD_COLUMNS: { key: string; label: string }[] = [
  { key: 'title', label: '文献标题' },
  { key: 'doc_category', label: '文献类型' },
  { key: 'received_date', label: '收稿年月' },
  { key: 'keywords', label: '关键词' },
  { key: 'departments', label: '就诊科室' },
  { key: 'authority_level', label: '置信度' },
  { key: 'authority_basis', label: '置信度依据' },
  { key: 'classification', label: '分类体系' },
]

export const exportService = {
  exportToExcel(documents: Document[], filename = 'export.xlsx') {
    const rows = documents.map((doc) => {
      const row: Record<string, unknown> = {
        '文件名': doc.filename,
        '布局': doc.doc_type === 'single_col' ? '单栏' : '双栏',
        '提取置信度': doc.extraction_confidence,
      }
      for (const col of FIELD_COLUMNS) {
        const value = doc.fields[col.key as keyof typeof doc.fields]
        if (Array.isArray(value)) {
          row[col.label] = value.join('；')
        } else {
          row[col.label] = value ?? ''
        }
      }
      return row
    })

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '文献数据')
    XLSX.writeFile(wb, filename)
  },
}
