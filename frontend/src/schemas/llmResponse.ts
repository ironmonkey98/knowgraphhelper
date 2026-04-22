import { z } from 'zod'

export const ExtractedFieldsSchema = z.object({
  title: z.string().nullable().optional(),
  doc_category: z.enum(['指南', '共识', '系统综述', '论文集', '国家标准', '教材', '职业健康', '其他']).optional(),
  received_date: z.string().nullable().optional(),
  keywords: z.array(z.string()).max(10).optional(),
  departments: z.array(z.string()).max(3).optional(),
  authority_level: z.enum(['权威', '高', '一般', '待评估']).optional(),
  authority_basis: z.string().nullable().optional(),
  classification: z.array(z.string()).optional(),
}).passthrough()

export const LlmResponseSchema = z.object({
  fields: ExtractedFieldsSchema,
  source_snippets: z.record(z.string()).optional(),
  extraction_confidence: z.number().min(0).max(1).optional(),
}).passthrough()
