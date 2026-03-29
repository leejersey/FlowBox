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
    <aside className="w-16 h-full flex flex-col items-center py-6 glass-sidebar pt-12 shrink-0 z-40 relative">
      <nav className="flex-1 flex flex-col gap-4 mt-8 w-full items-center">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "p-3 rounded-2xl transition-all duration-200 relative group text-on-surface-variant hover:text-on-surface hover:bg-white/30",
                isActive && "text-primary bg-white/50 shadow-sm"
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
              "p-3 rounded-2xl transition-all duration-200 text-on-surface-variant hover:text-on-surface hover:bg-white/30",
              isActive && "text-primary bg-white/50 shadow-sm"
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
