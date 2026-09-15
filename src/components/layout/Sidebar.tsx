import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
  CheckSquare, Lightbulb, Timer, Clipboard, Mic, BarChart3,
  Settings, FileType2, Search, Flame, ChevronLeft, ChevronRight, type LucideIcon
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  path: string
  icon: LucideIcon
  label: string
  eng: string
}

interface NavSection {
  title: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    title: '心流工作',
    items: [
      { path: '/', icon: CheckSquare, label: '待办清单', eng: 'Todo' },
      { path: '/pomodoro', icon: Timer, label: '专注番茄', eng: 'Pomodoro' },
      { path: '/stats', icon: BarChart3, label: '效能看板', eng: 'Stats' },
    ]
  },
  {
    title: '捕获记忆',
    items: [
      { path: '/idea', icon: Lightbulb, label: '灵感便签', eng: 'Ideas' },
      { path: '/clipboard', icon: Clipboard, label: '剪贴历史', eng: 'Clipboard' },
      { path: '/voice', icon: Mic, label: '语音速记', eng: 'Voice' },
    ]
  },
  {
    title: '提效工具',
    items: [
      { path: '/markdown', icon: FileType2, label: '格式转换', eng: 'Markdown' },
      { path: '/trending', icon: Flame, label: '极客热榜', eng: 'Trending' },
    ]
  }
]

interface SidebarProps {
  onSearchClick?: () => void
}

export function Sidebar({ onSearchClick }: SidebarProps) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true'
  })

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', String(collapsed))
  }, [collapsed])

  return (
    <aside
      className={cn(
        "h-full flex flex-col py-5 glass-sidebar pt-8 shrink-0 z-40 relative transition-all duration-300 ease-in-out select-none",
        collapsed ? "w-16 items-center px-2" : "w-52 px-3"
      )}
    >
      {/* 顶部 Logo 与应用名称 */}
      <div className={cn(
        "flex items-center gap-3 mb-4 cursor-pointer group",
        collapsed ? "justify-center" : "px-2"
      )}>
        <div className="w-9 h-9 rounded-xl overflow-hidden shadow-md shadow-black/30 border border-white/10 shrink-0 group-hover:scale-105 transition-transform relative">
          <img src="/logo.png" alt="FlowBox" className="w-full h-full object-cover pointer-events-none" />
          <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors pointer-events-none" />
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0 animate-fade-in">
            <span className="font-display font-bold text-sm tracking-tight text-on-surface leading-tight">FlowBox</span>
            <span className="text-[10px] text-on-surface-variant/70 font-mono">Workspace</span>
          </div>
        )}
      </div>

      {/* 全局搜索触发按钮 */}
      {collapsed ? (
        <button
          onClick={onSearchClick}
          className="p-2.5 rounded-xl mb-4 text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-all duration-200 group relative"
          title="全局搜索 (⌘/)"
        >
          <Search className="w-4 h-4 stroke-[2.5]" />
          <span className="absolute left-14 top-1/2 -translate-y-1/2 bg-surface-container-highest text-on-surface text-[10px] font-bold px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg border border-white/10 z-50">
            搜索 ⌘/
          </span>
        </button>
      ) : (
        <button
          onClick={onSearchClick}
          className="w-full h-9 rounded-xl mb-4 bg-surface-container-low/80 hover:bg-surface-container border border-outline-variant/20 px-3 flex items-center justify-between text-on-surface-variant hover:text-on-surface transition-all cursor-pointer group shadow-xs animate-fade-in"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-on-surface-variant/70 group-hover:text-primary transition-colors" />
            <span className="text-xs font-medium">全局搜索</span>
          </div>
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant/60 border border-outline-variant/30">
            ⌘/
          </kbd>
        </button>
      )}

      {/* 中部导航分类列表 */}
      <nav className="flex-1 flex flex-col gap-4 w-full overflow-y-auto overflow-x-hidden no-scrollbar py-1">
        {navSections.map((section, sIdx) => (
          <div key={section.title} className="flex flex-col gap-1 w-full">
            {/* 分组标识 */}
            {!collapsed ? (
              <div className="px-2.5 pb-1 text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider animate-fade-in">
                {section.title}
              </div>
            ) : (
              sIdx > 0 && <div className="w-8 h-[1px] bg-outline-variant/20 mx-auto my-1" />
            )}

            {/* 导航项 */}
            {section.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    "rounded-xl transition-all duration-200 relative group flex items-center cursor-pointer",
                    collapsed
                      ? "p-2.5 justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest/60"
                      : "px-3 py-2 gap-3 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest/50",
                    isActive && (
                      collapsed
                        ? "text-primary bg-primary/15 shadow-xs font-semibold"
                        : "text-primary bg-primary/10 shadow-xs font-semibold"
                    )
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon className="w-4 h-4 stroke-[2.2] shrink-0" />
                    
                    {!collapsed && (
                      <span className="text-xs font-medium truncate flex-1 animate-fade-in">
                        {item.label}
                      </span>
                    )}

                    {/* 折叠模式下的指示条 */}
                    {isActive && collapsed && (
                      <div className="absolute -left-0.5 top-1/2 -translate-y-1/2 w-1 h-4 bg-primary rounded-r-full shadow-xs" />
                    )}

                    {/* 折叠模式下的悬浮气泡 */}
                    {collapsed && (
                      <span className="absolute left-14 top-1/2 -translate-y-1/2 bg-surface-container-highest text-on-surface text-xs font-semibold px-2.5 py-1 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-150 whitespace-nowrap pointer-events-none shadow-xl border border-outline-variant/30 z-50">
                        {item.label}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* 底部功能区：设置与折叠切换 */}
      <div className={cn(
        "mt-auto pt-3 border-t border-outline-variant/15 flex flex-col gap-1 w-full",
        collapsed ? "items-center" : ""
      )}>
        {/* 设置 */}
        <NavLink
          to="/settings"
          title="偏好设置 (⌘,)"
          aria-label="打开偏好设置"
          className={({ isActive }) =>
            cn(
              'self-start p-2.5 rounded-xl text-on-surface-variant hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              collapsed && 'self-center',
              isActive && 'text-primary bg-primary/10',
            )
          }
        >
          <Settings className="w-4 h-4" aria-hidden="true" />
        </NavLink>

        {/* 展开 / 折叠切换控制 */}
        <button
          onClick={() => setCollapsed(v => !v)}
          className={cn(
            "rounded-xl text-on-surface-variant/70 hover:text-on-surface hover:bg-surface-container-highest/50 transition-colors flex items-center cursor-pointer",
            collapsed ? "p-2.5 justify-center" : "px-3 py-2 gap-3"
          )}
          title={collapsed ? "展开侧边栏" : "折叠侧边栏"}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4 shrink-0" />
              <span className="text-xs font-medium truncate flex-1 text-left animate-fade-in">
                折叠侧栏
              </span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
