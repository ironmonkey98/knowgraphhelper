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
      {/* 固定最大高度，内部可滚动 */}
      <DialogContent className="max-w-3xl w-full flex flex-col" style={{ maxHeight: '75vh' }}>
        <DialogHeader className="shrink-0">
          <DialogTitle>提示词设置</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">修改 LLM 提取时使用的系统提示词，可上下滚动查看全文</p>
        </DialogHeader>

        {/* 可滚动文本区域容器 */}
        <div className="flex-1 overflow-y-auto min-h-0 rounded-lg border border-border bg-muted/30">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="font-mono text-xs leading-relaxed resize-none border-0 bg-transparent focus-visible:ring-0 min-h-full"
            style={{ minHeight: '320px' }}
          />
        </div>

        <DialogFooter className="shrink-0 gap-2 mt-2">
          <Button variant="outline" onClick={handleReset}>恢复默认</Button>
          <Button onClick={handleSave}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
