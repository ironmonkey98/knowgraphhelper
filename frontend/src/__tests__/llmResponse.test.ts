import { describe, it, expect } from 'vitest'
import { LlmResponseSchema } from '@/schemas/llmResponse'

const validResponse = {
  fields: {
    title: 'Test Paper',
    authors: 'Zhang San, Li Si',
    journal: 'Nature',
    doi: '10.1234/test',
    doc_category: '论文集',
    received_date: '2024年1月',
    keywords: ['test', 'clinical'],
    departments: ['心血管内科'],
    authority_level: '高',
    authority_basis: 'SCI 核心库',
    classification: ['临床研究'],
    sample_size: { total: 200, experimental: 100, control: 100 },
    effect_size: { type: 'OR', point: 1.5, ci_lower: 1.1, ci_upper: 2.0 },
    p_value: '<0.001',
  },
  source_snippets: { title: 'Test Paper' },
  extraction_confidence: 0.85,
}

describe('LlmResponseSchema', () => {
  it('accepts valid response', () => {
    const result = LlmResponseSchema.safeParse(validResponse)
    expect(result.success).toBe(true)
  })

  it('accepts minimal response with nulls', () => {
    const minimal = {
      fields: {
        title: null,
        authors: null,
        journal: null,
        doi: null,
        doc_category: '其他',
        received_date: null,
        keywords: [],
        departments: ['全科医学'],
        authority_level: '待评估',
        authority_basis: null,
        classification: [],
        sample_size: null,
        effect_size: null,
        p_value: null,
      },
      source_snippets: {},
      extraction_confidence: 0.0,
    }
    const result = LlmResponseSchema.safeParse(minimal)
    expect(result.success).toBe(true)
  })

  it('rejects invalid doc_category', () => {
    const bad = { ...validResponse, fields: { ...validResponse.fields, doc_category: 'invalid' } }
    const result = LlmResponseSchema.safeParse(bad)
    expect(result.success).toBe(false)
  })

  it('rejects confidence out of range', () => {
    const bad = { ...validResponse, extraction_confidence: 1.5 }
    const result = LlmResponseSchema.safeParse(bad)
    expect(result.success).toBe(false)
  })

  it('rejects missing fields', () => {
    const { fields, ...noFields } = validResponse
    const result = LlmResponseSchema.safeParse(noFields)
    expect(result.success).toBe(false)
  })

  it('rejects keywords exceeding max', () => {
    const tooMany = Array.from({ length: 15 }, (_, i) => `keyword${i}`)
    const bad = { ...validResponse, fields: { ...validResponse.fields, keywords: tooMany } }
    const result = LlmResponseSchema.safeParse(bad)
    expect(result.success).toBe(false)
  })
})
