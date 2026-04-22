import { Link, Outlet, useLocation } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

const NAV_ITEMS = [
  { to: '/', label: '上传' },
  { to: '/records', label: '记录' },
]

export function AppShell() {
  const location = useLocation()

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-white">
          <div className="mx-auto flex h-14 max-w-7xl items-center px-4">
            <h1 className="text-lg font-semibold text-foreground mr-8">
              KnowGraphHelper
            </h1>
            <nav className="flex gap-6">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`text-sm transition-colors ${
                    location.pathname === item.to
                      ? 'text-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">
          <Outlet />
        </main>
        <Toaster />
      </div>
    </TooltipProvider>
  )
}
