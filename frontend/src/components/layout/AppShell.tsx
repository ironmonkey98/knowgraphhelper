import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { LlmConfigDialog } from '@/components/settings/LlmConfigDialog'
import { PromptConfigDialog } from '@/components/settings/PromptConfigDialog'
import { useLlmConfigStore } from '@/stores/llmConfigStore'

const NAV_ITEMS = [
  { to: '/', label: '上传文献' },
  { to: '/records', label: '文献记录' },
]

export function AppShell() {
  const location = useLocation()
  const isConfigured = useLlmConfigStore((s) => s.isConfigured)
  const [showLlmConfig, setShowLlmConfig] = useState(false)
  const [showPromptConfig, setShowPromptConfig] = useState(false)

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {/* 顶部导航栏 — 白色背景，底部分割线 */}
        <header className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
          <div className="mx-auto flex h-14 max-w-screen-xl items-center px-5 gap-6">

            {/* Logo + 产品名 */}
            <Link to="/" className="flex items-center gap-2.5 shrink-0">
              <img
                src="/logo.png"
                alt="小添医钥"
                className="h-8 w-8 rounded-lg object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                  const fb = document.getElementById('logo-fallback')
                  if (fb) fb.style.display = 'flex'
                }}
              />
              {/* 降级图标：青绿色 */}
              <div
                id="logo-fallback"
                style={{ display: 'none', background: '#36B3B3' }}
                className="h-8 w-8 items-center justify-center rounded-lg"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <span className="text-base font-bold" style={{ color: '#333333' }}>小添医钥</span>
            </Link>

            <div className="flex-1" />

            {/* 主导航 — 参考图风格：文字链接 + 激活下划线 */}
            <nav className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const active = location.pathname === item.to
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="relative px-3 py-1.5 text-sm font-medium transition-colors"
                    style={{ color: active ? '#7B7CE5' : '#666666' }}
                  >
                    {item.label}
                    {active && (
                      <span
                        className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full"
                        style={{ background: '#7B7CE5' }}
                      />
                    )}
                  </Link>
                )
              })}
            </nav>

            {/* LLM 状态 + 配置按钮 */}
            <div className="flex items-center gap-2">
              {/* LLM 状态 pill */}
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
                style={isConfigured()
                  ? { background: 'rgba(61,190,139,0.08)', color: '#2d9e6e', borderColor: 'rgba(61,190,139,0.25)' }
                  : { background: 'rgba(245,166,35,0.08)', color: '#b87a10', borderColor: 'rgba(245,166,35,0.25)' }
                }
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: isConfigured() ? '#3DBE8B' : '#F5A623' }}
                />
                {isConfigured() ? 'LLM 已连接' : 'LLM 未配置'}
              </div>

              {/* LLM 配置按钮 */}
              <button
                onClick={() => setShowLlmConfig(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                style={{ color: '#666666', borderColor: '#E2E5EC', background: 'transparent' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#7B7CE5'
                  e.currentTarget.style.color = '#7B7CE5'
                  e.currentTarget.style.background = 'rgba(123,124,229,0.05)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#E2E5EC'
                  e.currentTarget.style.color = '#666666'
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
                </svg>
                LLM 配置
              </button>

              {/* 提示词按钮 */}
              <button
                onClick={() => setShowPromptConfig(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                style={{ color: '#666666', borderColor: '#E2E5EC', background: 'transparent' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#7B7CE5'
                  e.currentTarget.style.color = '#7B7CE5'
                  e.currentTarget.style.background = 'rgba(123,124,229,0.05)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#E2E5EC'
                  e.currentTarget.style.color = '#666666'
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                提示词
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-screen-xl px-5 py-6">
          <Outlet />
        </main>

        <Toaster position="top-right" />
        <LlmConfigDialog open={showLlmConfig} onOpenChange={setShowLlmConfig} />
        <PromptConfigDialog open={showPromptConfig} onOpenChange={setShowPromptConfig} />
      </div>
    </TooltipProvider>
  )
}
