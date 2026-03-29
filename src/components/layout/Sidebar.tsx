import { NavLink } from 'react-router-dom'
import { CheckSquare, Lightbulb, Timer, Clipboard, Mic, BarChart3, Settings, FileType2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { path: '/', icon: CheckSquare, label: 'Todo' },
  { path: '/idea', icon: Lightbulb, label: 'Ideas' },
  { path: '/pomodoro', icon: Timer, label: 'Pomodoro' },
  { path: '/clipboard', icon: Clipboard, label: 'Clipboard' },
  { path: '/voice', icon: Mic, label: 'Voice' },
  { path: '/markdown', icon: FileType2, label: 'Markdown Converter' },
  { path: '/stats', icon: BarChart3, label: 'Stats' },
]

export function Sidebar() {
  return (
    <aside className="w-16 h-full flex flex-col items-center py-6 glass-sidebar pt-8 shrink-0 z-40 relative">
      {/* App Logo */}
      <div className="w-10 h-10 rounded-[14px] overflow-hidden shadow-lg shadow-black/40 border border-white/10 flex-shrink-0 mb-8 cursor-pointer hover:scale-105 transition-transform group relative" title="FlowBox">
        <img src="/logo.png" alt="FlowBox Logo" className="w-full h-full object-cover pointer-events-none" />
        <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors pointer-events-none" />
      </div>

      <nav className="flex-1 flex flex-col gap-4 w-full items-center">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "p-3 rounded-2xl transition-all duration-200 relative group text-on-surface-variant hover:text-on-surface hover:bg-on-surface/10",
                isActive && "text-primary bg-primary/15 shadow-sm"
              )
            }
            title={item.label}
          >
            <item.icon className="w-5 h-5 stroke-[2.5]" />
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto mb-4 w-full flex items-center justify-center">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              "p-3 rounded-2xl transition-all duration-200 text-on-surface-variant hover:text-on-surface hover:bg-on-surface/10",
              isActive && "text-primary bg-primary/15 shadow-sm"
            )
          }
          title="Settings"
        >
          <Settings className="w-5 h-5 stroke-[2.5]" />
        </NavLink>
      </div>
    </aside>
  )
}
