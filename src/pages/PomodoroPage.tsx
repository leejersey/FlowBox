import { useState, useEffect, useCallback } from 'react'
import { Play, Pause, Square, SkipForward, ChevronRight, ListChecks } from 'lucide-react'
import { cn } from '@/lib/utils'
import * as pomodoroService from '@/services/pomodoroService'
import { useTodos } from '@/hooks/useTodos'
import type { PomodoroType, PomodoroState, PomodoroSession } from '@/types/pomodoro'

const isTauri = typeof window !== 'undefined' && '__TAURI__' in window

const typeConfigs: { type: PomodoroType; label: string; minutes: number }[] = [
  { type: 'focus', label: '专注', minutes: 25 },
  { type: 'short_break', label: '短休息', minutes: 5 },
  { type: 'long_break', label: '长休息', minutes: 15 },
]

function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export function PomodoroPage() {
  const [state, setState] = useState<PomodoroState>(pomodoroService.pomodoroGetState())
  const [selectedType, setSelectedType] = useState<PomodoroType>('focus')
  const [sessions, setSessions] = useState<PomodoroSession[]>([])
  const [todayStats, setTodayStats] = useState({ count: 0, minutes: 0, rate: 0 })
  const [selectedTodoId, setSelectedTodoId] = useState<number | null>(state.related_todo_id)

  const { todos } = useTodos({ limit: 100 })
  const activeTodos = todos.filter(t => t.status !== 'done')

  const remaining = Math.max(0, state.total_seconds - state.elapsed_seconds)
  const progress = state.total_seconds > 0 ? state.elapsed_seconds / state.total_seconds : 0
  const circumference = 2 * Math.PI * 150
  const dashoffset = circumference * (1 - progress)
  const config = typeConfigs.find(c => c.type === selectedType)!

  const isActive = state.is_running || state.elapsed_seconds > 0

  // 注册 tick 回调
  useEffect(() => {
    pomodoroService.pomodoroOnTick(s => setState({ ...s }))
    pomodoroService.pomodoroOnComplete(() => {
      setState(pomodoroService.pomodoroGetState())
      loadData()
    })
  }, [])

  const loadData = useCallback(async () => {
    if (!isTauri) return
    try {
      const today = new Date().toISOString().slice(0, 10)
      const list = await pomodoroService.pomodoroListSessions({ date_from: today + 'T00:00:00', limit: 20 })
      setSessions(list)

      const stats = await pomodoroService.pomodoroStats(today + 'T00:00:00', today + 'T23:59:59')
      const rate = stats.session_count > 0 ? Math.round((stats.completed_count / stats.session_count) * 100) : 0
      setTodayStats({ count: stats.completed_count, minutes: stats.total_focus_minutes, rate })
    } catch { /* ignore in browser */ }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleStart = async () => {
    await pomodoroService.pomodoroStart({
      type: selectedType,
      duration_minutes: config.minutes,
      related_todo_id: selectedTodoId || undefined
    })
    setState(pomodoroService.pomodoroGetState())
  }

  const handlePauseResume = () => {
    if (state.is_running) {
      pomodoroService.pomodoroPause()
    } else {
      pomodoroService.pomodoroResume()
    }
    setState(pomodoroService.pomodoroGetState())
  }

  const handleStop = async () => {
    await pomodoroService.pomodoroStop(true)
    setState(pomodoroService.pomodoroGetState())
    await loadData()
  }

  const handleSkip = async () => {
    await pomodoroService.pomodoroStop(false)
    setState(pomodoroService.pomodoroGetState())
    await loadData()
  }

  return (
    <div className="flex flex-col lg:flex-row h-full animate-fade-in w-full max-w-6xl mx-auto gap-8 overflow-y-auto lg:overflow-hidden pb-10 lg:pb-0">

      {/* Left: Timer */}
      <div className="flex-[3] flex flex-col items-center justify-center p-8 relative min-h-[500px] lg:min-h-0">
        {/* Todo Selector */}
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-20">
          <div className="flex items-center gap-2 bg-surface-container-low px-4 py-2.5 rounded-full border border-white/5 shadow-sm transition-all focus-within:border-primary/20 focus-within:ring-1 focus-within:ring-primary/20">
            <ListChecks className="w-4 h-4 text-primary" />
            <select
              value={selectedTodoId ?? ''}
              onChange={e => setSelectedTodoId(e.target.value ? Number(e.target.value) : null)}
              disabled={isActive}
              className="bg-transparent text-sm font-medium text-on-surface outline-none cursor-pointer disabled:opacity-50 appearance-none min-w-[120px]"
            >
              <option value="">(不关联待办)</option>
              {activeTodos.map(t => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="relative w-80 h-80 flex items-center justify-center mb-12">
          <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full pointer-events-none" />

          <svg className="absolute inset-0 w-full h-full -rotate-90">
            <circle cx="160" cy="160" r="150" stroke="currentColor" strokeWidth="8" fill="none" className="text-surface-container-highest" />
            <circle
              cx="160" cy="160" r="150"
              stroke="url(#indigo-grad)" strokeWidth="8" fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashoffset}
              className="transition-all duration-1000 ease-linear"
            />
            <defs>
              <linearGradient id="indigo-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--color-primary)" />
                <stop offset="100%" stopColor="var(--color-primary-container)" />
              </linearGradient>
            </defs>
          </svg>

          <div className="relative flex flex-col items-center z-10">
            <span className="text-[5rem] font-display font-bold text-on-surface tabular-nums tracking-tight leading-none mb-4">
              {isActive ? formatTime(remaining) : formatTime(config.minutes * 60)}
            </span>
            <span className="px-3 py-1 bg-surface-container-highest text-on-surface-variant font-medium text-sm rounded-full">
              {state.is_running ? (state.type === 'focus' ? '专注中 🍅' : '休息中 ☕') :
               state.elapsed_seconds > 0 ? '已暂停 ⏸' : '准备开始'}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-6 mb-12">
          {isActive && (
            <button onClick={handleStop} className="p-4 rounded-full bg-surface-container hover:bg-surface-container-highest active:scale-95 transition-all text-on-surface-variant group">
              <Square className="w-5 h-5 group-hover:text-red-500 fill-current" />
            </button>
          )}

          <button
            onClick={isActive ? handlePauseResume : handleStart}
            className="w-20 h-20 rounded-full primary-gradient-button flex items-center justify-center active:scale-95 transition-all shadow-[0_8px_32px_rgba(70,72,212,0.3)]"
          >
            {state.is_running
              ? <Pause className="w-8 h-8 fill-current" />
              : <Play className="w-8 h-8 fill-current ml-1" />
            }
          </button>

          {isActive && (
            <button onClick={handleSkip} className="p-4 rounded-full bg-surface-container hover:bg-surface-container-highest active:scale-95 transition-all text-on-surface-variant group">
              <SkipForward className="w-5 h-5 group-hover:text-primary fill-current" />
            </button>
          )}
        </div>

        {/* Session Type Chips */}
        <div className="flex items-center gap-3 absolute bottom-8">
          {typeConfigs.map(tc => (
            <button
              key={tc.type}
              onClick={() => { if (!isActive) setSelectedType(tc.type) }}
              className={cn(
                "px-5 py-2.5 rounded-full text-sm font-medium transition-colors",
                selectedType === tc.type
                  ? "bg-primary text-white shadow-md"
                  : "bg-surface-container text-on-surface-variant hover:text-on-surface",
                isActive && "opacity-50 pointer-events-none"
              )}
            >
              {tc.label} {tc.minutes}min
            </button>
          ))}
        </div>
      </div>

      {/* Right: Stats */}
      <div className="flex-[2] bg-surface-container-low/50 rounded-[32px] p-8 flex flex-col h-full overflow-hidden border border-white/40 shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)]">
        <h2 className="text-2xl font-display font-bold text-on-surface mb-8">今日专注</h2>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-surface p-5 rounded-2xl shadow-sm">
            <p className="text-sm font-medium text-on-surface-variant mb-2">已完成番茄 🍅</p>
            <p className="text-3xl font-display font-bold text-on-surface">{todayStats.count} <span className="text-lg font-medium text-on-surface-variant">个</span></p>
          </div>
          <div className="bg-surface p-5 rounded-2xl shadow-sm">
            <p className="text-sm font-medium text-on-surface-variant mb-2">总专注时长 ⏳</p>
            <p className="text-3xl font-display font-bold text-on-surface">
              {Math.floor(todayStats.minutes / 60) > 0 && <>{Math.floor(todayStats.minutes / 60)}<span className="text-base font-medium mx-0.5">h</span></>}
              {todayStats.minutes % 60}<span className="text-base font-medium ml-0.5">m</span>
            </p>
          </div>
          <div className="col-span-2 bg-surface p-5 rounded-2xl shadow-sm flex items-center justify-between">
            <div className="flex flex-col">
              <p className="text-sm font-medium text-on-surface-variant mb-1">完成率</p>
              <p className="text-xl font-display font-bold text-on-surface">{todayStats.rate}%</p>
            </div>
            <div className="w-48 h-2 bg-surface-container rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${todayStats.rate}%` }} />
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto">
          <h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider mb-4">时间线</h3>

          {sessions.length === 0 && (
            <p className="text-sm text-on-surface-variant text-center py-8">今天还没有专注记录</p>
          )}

          <div className="space-y-6 relative before:absolute before:inset-y-0 before:left-2.5 before:w-0.5 before:bg-surface-container">
            {sessions.map(s => {
              const start = new Date(s.started_at)
              const end = s.ended_at ? new Date(s.ended_at) : null
              const cardTitle = s.todo_title || null
              return (
                <div key={s.id} className="relative pl-8">
                  <div className={cn(
                    "absolute left-0 top-1.5 w-5 h-5 rounded-full border-2 border-surface flex items-center justify-center",
                    s.status === 'completed' ? "bg-primary/20" : "bg-surface-container-highest"
                  )}>
                    <div className={cn("w-2 h-2 rounded-full", s.status === 'completed' ? "bg-primary" : "bg-on-surface-variant")} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-on-surface">
                        {start.toTimeString().slice(0, 5)}{end ? ` - ${end.toTimeString().slice(0, 5)}` : ''}
                      </span>
                      <span className={cn("text-xs px-2 py-0.5 rounded", s.status === 'completed' ? "text-primary bg-primary/10" : "text-on-surface-variant bg-surface-container")}>
                        {s.status === 'completed' ? '完成' : '中断'}
                      </span>
                    </div>
                    <p className="text-[15px] font-medium text-on-surface">
                      {s.type === 'focus' ? '专注' : s.type === 'short_break' ? '短休息' : '长休息'}
                      {cardTitle ? `：${cardTitle}` : ''} · {s.actual_minutes ?? s.duration_minutes}min
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-surface-container flex justify-center">
          <button className="text-sm font-bold text-primary hover:underline underline-offset-4 flex items-center gap-1">
            查看完整专注趋势 <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
