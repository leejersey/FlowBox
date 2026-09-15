import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ShieldCheck, Play, Timer } from 'lucide-react'
import { pomodoroGetState, pomodoroOnTick } from '@/services/pomodoroService'
import type { PomodoroState } from '@/types/pomodoro'

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export function StatusBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [pomodoroState, setPomodoroState] = useState<PomodoroState>(() => pomodoroGetState())

  useEffect(() => {
    // 订阅番茄钟状态更新
    return pomodoroOnTick((state) => {
      setPomodoroState(state)
    })
  }, [])

  const remainingSeconds = Math.max(0, pomodoroState.total_seconds - pomodoroState.elapsed_seconds)
  const isPomodoroRunning = pomodoroState.is_running && remainingSeconds > 0

  return (
    <footer className="h-6 w-full shrink-0 border-t border-outline-variant/15 bg-surface/80 backdrop-blur-xl px-4 flex items-center justify-between text-[11px] text-on-surface-variant/70 select-none z-30 font-medium">
      {/* 左侧：本地数据离线安全状态 */}
      <div className="flex items-center gap-1.5 shrink-0">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
        <span className="text-[10px] hidden sm:inline text-on-surface-variant/80 font-mono">SQLite 离线存储已就绪</span>
      </div>

      {/* 中间：运行中的番茄钟心流胶囊 */}
      <div className="flex-1 flex justify-center items-center">
        {isPomodoroRunning ? (
          <button
            onClick={() => navigate('/pomodoro')}
            className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition-all cursor-pointer animate-pulse"
            title="点击切换到番茄钟视图"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
            <Timer className="w-3 h-3" />
            <span className="font-mono font-bold text-[10px]">
              {pomodoroState.type === 'focus' ? '专注中' : '休息中'} {formatTime(remainingSeconds)}
            </span>
          </button>
        ) : (
          location.pathname !== '/pomodoro' && (
            <button
              onClick={() => navigate('/pomodoro')}
              className="flex items-center gap-1 text-[10px] text-on-surface-variant/50 hover:text-primary transition-colors cursor-pointer"
              title="快速开启专注会话"
            >
              <Play className="w-2.5 h-2.5" />
              <span>开启专注番茄</span>
            </button>
          )
        )}
      </div>

      {/* 右侧：上下文键盘快捷指引 */}
      <div className="flex items-center gap-3 shrink-0 text-[10px]">
        {location.pathname === '/' ? (
          <div className="flex items-center gap-2">
            <span><kbd className="font-mono bg-surface-container px-1 py-0.2 rounded border border-outline-variant/30">↑↓</kbd> 导航</span>
            <span><kbd className="font-mono bg-surface-container px-1 py-0.2 rounded border border-outline-variant/30">Space</kbd> 勾选</span>
            <span><kbd className="font-mono bg-surface-container px-1 py-0.2 rounded border border-outline-variant/30">⌘N</kbd> 新建</span>
          </div>
        ) : location.pathname === '/clipboard' ? (
          <div className="flex items-center gap-2">
            <span><kbd className="font-mono bg-surface-container px-1 py-0.2 rounded border border-outline-variant/30">↑↓</kbd> 导航</span>
            <span><kbd className="font-mono bg-surface-container px-1 py-0.2 rounded border border-outline-variant/30">⌘C</kbd> 复制</span>
            <span><kbd className="font-mono bg-surface-container px-1 py-0.2 rounded border border-outline-variant/30">Esc</kbd> 退出</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span><kbd className="font-mono bg-surface-container px-1 py-0.2 rounded border border-outline-variant/30">⌘1~5</kbd> 切换模块</span>
            <span><kbd className="font-mono bg-surface-container px-1 py-0.2 rounded border border-outline-variant/30">⌘/</kbd> 搜索</span>
          </div>
        )}
      </div>
    </footer>
  )
}
