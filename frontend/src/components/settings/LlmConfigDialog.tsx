import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLlmConfigStore } from '@/stores/llmConfigStore'
import type { LlmConfig } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DEFAULT_CONFIG: Omit<LlmConfig, 'api_key'> = {
  base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  model: 'qwen-max',
  temperature: 0.0,
}

export function LlmConfigDialog({ open, onOpenChange }: Props) {
  const config = useLlmConfigStore((s) => s.config)
  const setConfig = useLlmConfigStore((s) => s.setConfig)

  const [baseUrl, setBaseUrl] = useState(config?.base_url ?? DEFAULT_CONFIG.base_url)
  const [apiKey, setApiKey] = useState(config?.api_key ?? '')
  const [model, setModel] = useState(config?.model ?? DEFAULT_CONFIG.model)
  const [temperature, setTemperature] = useState(config?.temperature ?? DEFAULT_CONFIG.temperature)
  const [testing, setTesting] = useState(false)

  const handleSave = () => {
    if (!apiKey.trim()) {
      toast.error('请输入 API Key')
      return
    }
    setConfig({ base_url: baseUrl, api_key: apiKey, model, temperature })
    toast.success('配置已保存')
    onOpenChange(false)
  }

  const handleTest = async () => {
    if (!apiKey.trim()) {
      toast.error('请先输入 API Key')
      return
    }
    setTesting(true)
    try {
      const resp = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-LLM-Base-URL': baseUrl,
          'X-LLM-Api-Key': apiKey,
          'X-LLM-Model': model,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'ping' }],
          temperature: 0,
        }),
      })
      if (resp.ok) {
        toast.success('连接成功')
      } else {
        toast.error(`连接失败 (${resp.status})`)
      }
    } catch {
      toast.error('网络错误')
    } finally {
      setTesting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>LLM 配置</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Base URL</Label>
            <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
          </div>
          <div>
            <Label>API Key</Label>
            <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
          </div>
          <div>
            <Label>Model</Label>
            <Input value={model} onChange={(e) => setModel(e.target.value)} />
          </div>
          <div>
            <Label>Temperature</Label>
            <Input type="number" step="0.1" min="0" max="2" value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value) || 0)} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleTest} disabled={testing}>
            {testing ? '测试中...' : '测试连接'}
          </Button>
          <Button onClick={handleSave}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
