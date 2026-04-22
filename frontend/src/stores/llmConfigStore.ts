import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LlmConfig } from '@/types'

interface LlmConfigState {
  config: LlmConfig | null
  setConfig: (config: LlmConfig) => void
  clearConfig: () => void
  isConfigured: () => boolean
}

export const useLlmConfigStore = create<LlmConfigState>()(
  persist(
    (set, get) => ({
      config: null,
      setConfig: (config) => set({ config }),
      clearConfig: () => set({ config: null }),
      isConfigured: () => get().config !== null,
    }),
    { name: 'kgh:llm_config' },
  ),
)
