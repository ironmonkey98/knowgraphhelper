import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_SYSTEM_PROMPT } from '@/prompts/paperPrompt'

interface PromptState {
  customPrompt: string | null
  setCustomPrompt: (prompt: string | null) => void
  getEffectivePrompt: () => string
}

export const usePromptStore = create<PromptState>()(
  persist(
    (set, get) => ({
      customPrompt: null,
      setCustomPrompt: (prompt) => set({ customPrompt: prompt }),
      getEffectivePrompt: () => get().customPrompt ?? DEFAULT_SYSTEM_PROMPT,
    }),
    { name: 'kgh:prompt_config' },
  ),
)
