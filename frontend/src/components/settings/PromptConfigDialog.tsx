import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { usePromptStore } from '@/stores/promptStore'
import { DEFAULT_SYSTEM_PROMPT } from '@/prompts/paperPrompt'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PromptConfigDialog({ open, onOpenChange }: Props) {
  const customPrompt = usePromptStore((s) => s.customPrompt)
  const setCustomPrompt = usePromptStore((s) => s.setCustomPrompt)
  const [draft, setDraft] = useState('')

  // 每次打开同步最新值
  useEffect(() => {
    if (open) {
      setDraft(customPrompt ?? DEFAULT_SYSTEM_PROMPT)
    }
  }, [open, customPrompt])

  const handleSave = () => {
    setCustomPrompt(draft.trim() || null)
    toast.success('提示词已保存')
    onOpenChange(false)
  }

  const handleReset = () => {
    setDraft(DEFAULT_SYSTEM_PROMPT)
    setCustomPrompt(null)
    toast.success('已恢复默认提示词')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full">
        <DialogHeader>
          <DialogTitle>提示词设置</DialogTitle>
        </DialogHeader>
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="font-mono text-xs leading-relaxed resize-y"
          rows={30}
        />
        <DialogFooter className="gap-2 mt-2">
          <Button variant="outline" onClick={handleReset}>恢复默认</Button>
          <Button onClick={handleSave}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
