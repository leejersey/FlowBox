import { NavLink } from 'react-router-dom'
import { CheckSquare, Lightbulb, Timer, Clipboard, Mic, BarChart3, Settings, FileType2, Search, Flame } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { path: '/', icon: CheckSquare, label: 'Todo' },
  { path: '/idea', icon: Lightbulb, label: 'Ideas' },
  { path: '/pomodoro', icon: Timer, label: 'Pomodoro' },
  { path: '/clipboard', icon: Clipboard, label: 'Clipboard' },
  { path: '/voice', icon: Mic, label: 'Voice' },
  { path: '/markdown', icon: FileType2, label: 'Markdown Converter' },
  { path: '/trending', icon: Flame, label: 'Trending' },
  { path: '/stats', icon: BarChart3, label: 'Stats' },
]

interface SidebarProps {
  onSearchClick?: () => void
}

export function Sidebar({ onSearchClick }: SidebarProps) {
  return (
    <aside className="w-16 h-full flex flex-col items-center py-6 glass-sidebar pt-8 shrink-0 z-40 relative">
      {/* App Logo */}
      <div className="w-10 h-10 rounded-[14px] overflow-hidden shadow-lg shadow-black/40 border border-white/10 flex-shrink-0 mb-4 cursor-pointer hover:scale-105 transition-transform group relative" title="FlowBox">
        <img src="/logo.png" alt="FlowBox Logo" className="w-full h-full object-cover pointer-events-none" />
        <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors pointer-events-none" />
      </div>

      {/* Search Button */}
      <button
        onClick={onSearchClick}
        className="p-2.5 rounded-2xl mb-4 text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-all duration-200 group relative"
        title="全局搜索 (⌘/)"
      >
        <Search className="w-5 h-5 stroke-[2.5]" />
        <span className="absolute left-14 top-1/2 -translate-y-1/2 bg-surface-container-highest text-on-surface text-[10px] font-bold px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg border border-white/10">
          搜索 ⌘/
        </span>
      </button>

      <nav className="flex-1 flex flex-col gap-3 w-full items-center">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "p-3 rounded-2xl transition-all duration-200 relative group text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest/60",
                isActive && "text-primary bg-primary/15 shadow-sm font-semibold"
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className="w-5 h-5 stroke-[2.2]" />
                {isActive && (
                  <div className="absolute -left-0.5 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full shadow-sm" />
                )}
                {/* 桌面精致悬浮气泡 */}
                <span className="absolute left-14 top-1/2 -translate-y-1/2 bg-surface-container-highest text-on-surface text-xs font-semibold px-2.5 py-1 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-150 whitespace-nowrap pointer-events-none shadow-xl border border-outline-variant/30 z-50">
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto mb-4 w-full flex items-center justify-center">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              "p-3 rounded-2xl transition-all duration-200 relative group text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest/60",
              isActive && "text-primary bg-primary/15 shadow-sm"
            )
          }
        >
          {({ isActive }) => (
            <>
              <Settings className="w-5 h-5 stroke-[2.2]" />
              {isActive && (
                <div className="absolute -left-0.5 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full shadow-sm" />
              )}
              <span className="absolute left-14 top-1/2 -translate-y-1/2 bg-surface-container-highest text-on-surface text-xs font-semibold px-2.5 py-1 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-150 whitespace-nowrap pointer-events-none shadow-xl border border-outline-variant/30 z-50">
                设置
              </span>
            </>
          )}
        </NavLink>
      </div>
    </aside>
  )
}

