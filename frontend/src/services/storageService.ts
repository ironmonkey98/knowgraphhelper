import { openDB } from 'idb'
import type { Document, LlmConfig } from '@/types'

const DB_NAME = 'kgh-files'
const STORE_NAME = 'pdf_blobs'

function getDb() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    },
  })
}

export const storageService = {
  // --- localStorage ---
  getLlmConfig(): LlmConfig | null {
    const raw = localStorage.getItem('kgh:llm_config')
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw)
      return parsed?.state?.config ?? null
    } catch {
      return null
    }
  },

  getDocuments(): Document[] {
    const raw = localStorage.getItem('kgh:documents')
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw)
      return parsed?.state?.documents ?? []
    } catch {
      return []
    }
  },

  // --- IndexedDB (PDF Blob) ---
  async savePdfBlob(docId: string, blob: Blob): Promise<void> {
    const db = await getDb()
    await db.put(STORE_NAME, blob, docId)
  },

  async getPdfBlob(docId: string): Promise<Blob | undefined> {
    const db = await getDb()
    return db.get(STORE_NAME, docId)
  },

  async deletePdfBlob(docId: string): Promise<void> {
    const db = await getDb()
    await db.delete(STORE_NAME, docId)
  },
}
