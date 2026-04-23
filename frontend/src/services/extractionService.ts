import { useDocumentsStore } from '@/stores/documentsStore'
import { useLlmConfigStore } from '@/stores/llmConfigStore'
import { usePromptStore } from '@/stores/promptStore'
import { PROMPT_VERSION } from '@/prompts/paperPrompt'
import type { DocType, Document, ExtractedFields } from '@/types'

const POLL_INTERVAL_MS = 2000
const API_BASE = '/api'

/**
 * 后端异步提取服务
 * 流程：前端提交 PDF → 后端后台运行完整流水线 → 前端轮询状态
 * 刷新页面不中断任务（任务在后端进程中运行）
 */
export const extractionService = {
  /**
   * 启动提取：上传 PDF → 获得 task_id → 开始轮询
   */
  async startExtraction(file: File, docType: DocType): Promise<string> {
    const docId = crypto.randomUUID()
    const { addDocument, updateDocument } = useDocumentsStore.getState()
    const llmConfig = useLlmConfigStore.getState().config
    const systemPrompt = usePromptStore.getState().getEffectivePrompt()

    if (!llmConfig) throw new Error('LLM 未配置')

    // 1. 创建占位文档（parsing 状态）
    const doc: Document = {
      id: docId,
      filename: file.name,
      doc_type: docType,
      status: 'parsing',
      uploaded_at: Date.now(),
      markdown: '',
      fields: {} as ExtractedFields,
      source_snippets: {},
      extraction_confidence: 0,
      prompt_version: PROMPT_VERSION,
    }
    addDocument(doc)

    // 2. 提交到后端
    const formData = new FormData()
    formData.append('file', file)
    formData.append('doc_type', docType)
    formData.append('system_prompt', systemPrompt)

    let taskId: string
    try {
      const resp = await fetch(`${API_BASE}/extract`, {
        method: 'POST',
        headers: {
          'X-LLM-Base-URL': llmConfig.base_url,
          'X-LLM-Api-Key': llmConfig.api_key,
          'X-LLM-Model': llmConfig.model,
          'X-LLM-Temperature': String(llmConfig.temperature),
        },
        body: formData,
      })

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: resp.statusText }))
        throw new Error(err.detail || `提交失败 [${resp.status}]`)
      }

      const data = await resp.json()
      taskId = data.task_id
    } catch (err) {
      const msg = err instanceof Error ? err.message : '提交任务失败'
      updateDocument(docId, { status: 'error', error_message: msg })
      throw err
    }

    // 3. 存储 task_id，用于页面刷新后恢复轮询
    updateDocument(docId, { task_id: taskId })

    // 4. 开始后台轮询（不 await，立即返回）
    this.pollTask(docId, taskId)

    return docId
  },

  /**
   * 轮询指定任务，直到完成或出错
   * 可安全地在页面刷新后重新调用（幂等）
   */
  pollTask(docId: string, taskId: string): void {
    const { updateDocument } = useDocumentsStore.getState()

    const poll = async () => {
      while (true) {
        await sleep(POLL_INTERVAL_MS)

        // 检查文档是否已被删除
        const currentDoc = useDocumentsStore.getState().documents.find((d) => d.id === docId)
        if (!currentDoc) return

        let task: TaskResult
        try {
          const resp = await fetch(`${API_BASE}/tasks/${taskId}`)
          if (resp.status === 404) {
            // 后端已重启，任务丢失
            updateDocument(docId, { status: 'error', error_message: '服务重启，任务中断，请重新上传' })
            return
          }
          if (!resp.ok) continue  // 网络抖动，继续重试
          task = await resp.json()
        } catch {
          // 网络错误，继续重试
          continue
        }

        // 同步中间状态（markdown 等）
        if (task.status === 'extracting' && task.markdown) {
          updateDocument(docId, {
            status: 'extracting',
            markdown: task.markdown,
            page_count: task.page_count ?? undefined,
            parse_time_ms: task.parse_time_ms ?? undefined,
          })
        }

        if (task.status === 'done' && task.result) {
          updateDocument(docId, {
            status: 'pending_review',
            markdown: task.markdown || '',
            page_count: task.page_count ?? undefined,
            parse_time_ms: task.parse_time_ms ?? undefined,
            fields: task.result.fields as unknown as ExtractedFields,
            source_snippets: task.result.source_snippets ?? {},
            extraction_confidence: task.result.extraction_confidence ?? 0,
          })
          return
        }

        if (task.status === 'error') {
          updateDocument(docId, { status: 'error', error_message: task.error ?? '提取失败' })
          return
        }
      }
    }

    // fire-and-forget，错误不会影响 UI
    poll().catch((err) => {
      console.error('[extractionService] poll error:', err)
      updateDocument(docId, { status: 'error', error_message: '轮询异常' })
    })
  },

  /**
   * App 启动时调用：恢复所有未完成文档的轮询
   * 针对页面刷新场景
   */
  resumeAllPending(): void {
    const { documents, updateDocument } = useDocumentsStore.getState()
    const pending = documents.filter(
      (d) => (d.status === 'parsing' || d.status === 'extracting') && d.task_id,
    )
    for (const doc of pending) {
      this.pollTask(doc.id, doc.task_id!)
    }

    // 没有 task_id 的遗留文档（旧版本遗留），直接标为错误
    const stuck = documents.filter(
      (d) => (d.status === 'parsing' || d.status === 'extracting') && !d.task_id,
    )
    for (const doc of stuck) {
      updateDocument(doc.id, { status: 'error', error_message: '页面刷新，任务中断，请重新上传' })
    }
  },
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

interface TaskResult {
  status: 'parsing' | 'extracting' | 'done' | 'error'
  markdown?: string | null
  page_count?: number | null
  parse_time_ms?: number | null
  result?: {
    fields: Record<string, unknown>
    source_snippets?: Record<string, string>
    extraction_confidence?: number
  } | null
  error?: string | null
}
