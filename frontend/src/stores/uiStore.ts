import { create } from 'zustand'

interface UiState {
  currentDocumentId: string | null
  highlightSpan: string | null
  pdfPreviewOpen: boolean
  setCurrentDocumentId: (id: string | null) => void
  setHighlightSpan: (span: string | null) => void
  setPdfPreviewOpen: (open: boolean) => void
}

export const useUiStore = create<UiState>()((set) => ({
  currentDocumentId: null,
  highlightSpan: null,
  pdfPreviewOpen: false,
  setCurrentDocumentId: (id) => set({ currentDocumentId: id }),
  setHighlightSpan: (span) => set({ highlightSpan: span }),
  setPdfPreviewOpen: (open) => set({ pdfPreviewOpen: open }),
}))
