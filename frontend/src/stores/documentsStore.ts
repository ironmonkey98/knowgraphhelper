import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Document } from '@/types'

interface DocumentsState {
  documents: Document[]
  addDocument: (doc: Document) => void
  updateDocument: (id: string, updates: Partial<Document>) => void
  removeDocument: (id: string) => void
  getDocument: (id: string) => Document | undefined
}

export const useDocumentsStore = create<DocumentsState>()(
  persist(
    (set, get) => ({
      documents: [],
      addDocument: (doc) => set((s) => ({ documents: [...s.documents, doc] })),
      updateDocument: (id, updates) =>
        set((s) => ({
          documents: s.documents.map((d) =>
            d.id === id ? { ...d, ...updates } : d,
          ),
        })),
      removeDocument: (id) =>
        set((s) => ({ documents: s.documents.filter((d) => d.id !== id) })),
      getDocument: (id) => get().documents.find((d) => d.id === id),
    }),
    { name: 'kgh:documents' },
  ),
)
