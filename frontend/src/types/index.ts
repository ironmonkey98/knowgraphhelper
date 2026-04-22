export type DocType = 'single_col' | 'double_col'

export type DocStatus =
  | 'parsing'
  | 'extracting'
  | 'pending_review'
  | 'reviewed'
  | 'error'

export interface ExtractedFields {
  title: string | null
  doc_category: '指南' | '共识' | '系统综述' | '论文集' | '国家标准' | '教材' | '职业健康' | '其他'
  received_date: string | null
  keywords: string[]
  departments: string[]
  authority_level: '权威' | '高' | '一般' | '待评估'
  authority_basis: string | null
  classification: string[]
}

export interface Document {
  id: string
  filename: string
  doc_type: DocType
  status: DocStatus
  uploaded_at: number
  markdown: string
  fields: ExtractedFields
  source_snippets: Record<string, string>
  extraction_confidence: number
  page_count?: number
  parse_time_ms?: number
  error_message?: string
  reviewed_at?: number
  prompt_version?: string
}

export interface LlmConfig {
  base_url: string
  api_key: string
  model: string
  temperature: number
}
