import type { LlmConfig } from '@/types'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface LlmChatParams {
  config: LlmConfig
  messages: ChatMessage[]
  response_format?: { type: string }
}

export const llmService = {
  async chat(params: LlmChatParams, retries = 1): Promise<unknown> {
    const { config, messages, response_format } = params
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-LLM-Base-URL': config.base_url,
      'X-LLM-Api-Key': config.api_key,
      'X-LLM-Model': config.model,
    }

    const body: Record<string, unknown> = {
      messages,
      temperature: config.temperature,
    }
    if (response_format) {
      body.response_format = response_format
    }

    const resp = await fetch('/api/llm/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!resp.ok) {
      // 401 → 不重试，弹配置
      if (resp.status === 401) {
        throw new Error('AUTH_FAILED')
      }
      // 429 → 等 1s 重试
      if (resp.status === 429 && retries > 0) {
        await new Promise((r) => setTimeout(r, 1000))
        return this.chat(params, retries - 1)
      }
      // 502/504 → 重试
      if (resp.status >= 502 && retries > 0) {
        return this.chat(params, retries - 1)
      }

      const err = await resp.json().catch(() => ({ detail: 'LLM 请求失败' }))
      throw new Error(err.detail || `LLM 请求失败 (${resp.status})`)
    }

    const data = await resp.json()
    // OpenAI 兼容格式：取第一个 choice 的 content
    const content = data?.choices?.[0]?.message?.content
    if (!content) {
      throw new Error('LLM 返回内容为空')
    }

    // 尝试提取 JSON（可能被 markdown 代码块包裹）
    return extractJson(content)
  },
}

function extractJson(text: string): unknown {
  // 去除 markdown 代码块标记
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    // 尝试提取第一个 JSON 对象
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1))
    }
    throw new Error('JSON 解析失败')
  }
}
