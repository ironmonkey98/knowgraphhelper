import type { DocType } from '@/types'

export interface ParseResult {
  document_id: string
  markdown: string
  page_count: number
  size_bytes: number
  parse_time_ms: number
}

export const parseService = {
  async parsePdf(file: File, _docType: DocType): Promise<ParseResult> {
    const formData = new FormData()
    formData.append('file', file)

    const resp = await fetch('/api/parse-pdf', {
      method: 'POST',
      body: formData,
    })

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ detail: '解析失败' }))
      throw new Error(err.detail || `解析失败 (${resp.status})`)
    }

    return resp.json()
  },
}
