import { useState, useEffect, useCallback, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Play, Pause, Square, SkipForward, ChevronRight, ListChecks,
  Minimize2, Maximize2, Sparkles, X
} from 'lucide-react'
import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window'
import { cn } from '@/lib/utils'
import { Select } from '@/components/ui/Select'
import * as pomodoroService from '@/services/pomodoroService'
import { useTodos } from '@/hooks/useTodos'
import { playPomodoroDoneSound } from '@/lib/soundEffects'
import { showToast } from '@/store/useToastStore'
import type { PomodoroType, PomodoroState, PomodoroSession } from '@/types/pomodoro'
import { localDayBounds } from '@/lib/localDate'

const isTauriApp = isTauri()

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

/** 隔离高频 1Hz Tick 的独立表盘组件 */
const PomodoroDial = memo(function PomodoroDial({
  configMinutes,
  onSessionComplete,
}: {
  configMinutes: number
  onSessionComplete: () => void
}) {
  const [state, setState] = useState<PomodoroState>(pomodoroService.pomodoroGetState())

  useEffect(() => {
    pomodoroService.pomodoroOnTick((s) => setState({ ...s }))
    pomodoroService.pomodoroOnComplete(() => {
      setState(pomodoroService.pomodoroGetState())
      playPomodoroDoneSound()
      onSessionComplete()
    })
  }, [onSessionComplete])

  const remaining = Math.max(0, state.total_seconds - state.elapsed_seconds)
  const progress = state.total_seconds > 0 ? state.elapsed_seconds / state.total_seconds : 0
  const circumference = 2 * Math.PI * 150
  const dashoffset = circumference * (1 - progress)
  const isActive = state.is_running || state.elapsed_seconds > 0

  return (
    <div className="relative w-64 h-64 lg:w-80 lg:h-80 flex flex-col items-center justify-center shrink-0">
      <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full pointer-events-none" />

      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 320 320">
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
          <linearGradient id="indigo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#4f46e5" />
          </linearGradient>
        </defs>
      </svg>

      <div className="z-10 flex flex-col items-center">
        <span className="text-6xl lg:text-7xl font-mono font-bold tracking-tighter text-on-surface select-none">
          {formatTime(isActive ? remaining : configMinutes * 60)}
        </span>
        <span className="text-sm font-semibold tracking-widest text-primary mt-3 uppercase">
          {state.is_running ? '心流专注中' : isActive ? '已暂停' : '准备专注'}
        </span>
      </div>
    </div>
  )
})

export function PomodoroPage() {
  const navigate = useNavigate()
  const { todos } = useTodos()
  const [selectedType, setSelectedType] = useState<PomodoroType>('focus')
  const [selectedTodoId, setSelectedTodoId] = useState<number | null>(null)
  const [sessions, setSessions] = useState<PomodoroSession[]>([])
  const [todayStats, setTodayStats] = useState({ count: 0, minutes: 0, rate: 0 })
  const [state, setState] = useState<PomodoroState>(pomodoroService.pomodoroGetState())
  const [isMiniWindow, setIsMiniWindow] = useState(false)
  const [isZenMode, setIsZenMode] = useState(false)

  const config = typeConfigs.find(c => c.type === selectedType) ?? typeConfigs[0]
  const isActive = state.is_running || state.elapsed_seconds > 0
  const activeTodos = todos.filter(t => t.status !== 'done')

  const loadData = useCallback(async () => {
    if (!isTauriApp) return
    const { startIso, endIso } = localDayBounds()
    const [list, stats] = await Promise.all([
      pomodoroService.pomodoroListSessions({ date_from: startIso, date_to: endIso }),
      pomodoroService.pomodoroStats(startIso, endIso),
    ])
    const rate = stats.session_count > 0 ? Math.round((stats.completed_count / stats.session_count) * 100) : 0
    setSessions(list)
    setTodayStats({ count: stats.completed_count, minutes: stats.total_focus_minutes, rate })
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!isTauriApp) return
      try {
        const { startIso, endIso } = localDayBounds()
        const [list, stats] = await Promise.all([
          pomodoroService.pomodoroListSessions({ date_from: startIso, date_to: endIso }),
          pomodoroService.pomodoroStats(startIso, endIso),
        ])
        if (cancelled) return
        const rate = stats.session_count > 0 ? Math.round((stats.completed_count / stats.session_count) * 100) : 0
        setSessions(list)
        setTodayStats({ count: stats.completed_count, minutes: stats.total_focus_minutes, rate })
      } catch {}
    })()

    return () => { cancelled = true }
  }, [])

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

  // 迷你悬浮窗模式切换
  const toggleMiniWindow = async () => {
    if (!isTauriApp) {
      showToast('浏览器预览模式不支持窗口尺寸收缩', 'info')
      return
    }
    try {
      const win = getCurrentWindow()
      if (!isMiniWindow) {
        await win.setSize(new LogicalSize(340, 160))
        await win.setAlwaysOnTop(true)
        setIsMiniWindow(true)
      } else {
        await win.setSize(new LogicalSize(1020, 720))
        await win.setAlwaysOnTop(false)
        setIsMiniWindow(false)
      }
    } catch (err) {
      showToast(`切换小窗失败: ${String(err)}`, 'error')
    }
  }

  // 迷你小窗特化视图
  if (isMiniWindow) {
    const remaining = Math.max(0, state.total_seconds - state.elapsed_seconds)
    const taskName = activeTodos.find(t => t.id === selectedTodoId)?.title || '心流专注'

    return (
      <div className="h-screen w-screen bg-surface p-4 flex items-center justify-between select-none" data-tauri-drag-region>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-primary/15 text-primary flex items-center justify-center font-bold text-lg shadow-xs">
            🍅
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-2xl font-mono font-bold text-on-surface leading-tight tracking-tight">
              {formatTime(isActive ? remaining : config.minutes * 60)}
            </span>
            <span className="text-xs text-on-surface-variant truncate max-w-[130px] font-medium">
              {taskName}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={isActive ? handlePauseResume : handleStart}
            className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center hover:opacity-90 transition-all cursor-pointer shadow-sm"
          >
            {state.is_running ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>
          <button
            onClick={toggleMiniWindow}
            className="p-2.5 rounded-xl bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-all cursor-pointer"
            title="还原大窗口"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full">
      {/* Zen 禅模式全屏覆盖 */}
      {isZenMode && (
        <div className="fixed inset-0 z-50 bg-surface flex flex-col items-center justify-center animate-fade-in select-none">
          <button
            onClick={() => setIsZenMode(false)}
            className="absolute top-8 right-8 p-3 rounded-2xl bg-surface-container hover:bg-surface-container-highest text-on-surface-variant transition-colors cursor-pointer flex items-center gap-2 text-xs font-bold"
          >
            <X className="w-4 h-4" />
            <span>退出禅模式 (Esc)</span>
          </button>

          <div className="mb-4 text-xs font-bold text-primary tracking-widest uppercase flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" />
            <span>Zen 心流结界</span>
          </div>

          <div className="text-lg font-bold text-on-surface mb-8">
            {activeTodos.find(t => t.id === selectedTodoId)?.title || '深度工作模式'}
          </div>

          <PomodoroDial
            configMinutes={config.minutes}
            onSessionComplete={loadData}
          />

          <div className="flex items-center gap-6 mt-10">
            {isActive && (
              <button onClick={handleStop} className="p-4 rounded-full bg-surface-container hover:bg-surface-container-highest text-on-surface-variant cursor-pointer">
                <Square className="w-5 h-5 fill-current" />
              </button>
            )}
            <button
              onClick={isActive ? handlePauseResume : handleStart}
              className="w-20 h-20 rounded-full primary-gradient-button flex items-center justify-center active:scale-95 transition-all shadow-xl cursor-pointer"
            >
              {state.is_running ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
            </button>
          </div>
        </div>
      )}

      {/* 正常工作台布局 */}
      <div className="flex flex-col xl:flex-row h-full animate-fade-in w-full max-w-6xl mx-auto gap-4 lg:gap-8 overflow-y-auto lg:overflow-hidden pb-4 lg:pb-0 custom-scrollbar">

        {/* Left: Timer */}
        <div className="flex-none xl:flex-[3] flex flex-col items-center justify-center w-full gap-6 lg:gap-8 py-6 xl:p-8 relative">
          {/* 桌面模式工具条（迷你小窗 & Zen 模式切换） */}
          <div className="w-full flex items-center justify-between px-2 shrink-0 z-20">
            <div className="flex-1 max-w-[280px]">
              <Select
                disabled={isActive}
                value={selectedTodoId ?? ''}
                onChange={(val: string | number | null) => setSelectedTodoId(val ? Number(val) : null)}
                icon={<ListChecks className="w-4 h-4" />}
                className="w-full"
                options={[
                  { label: '(不关联待办)', value: '' },
                  ...activeTodos.map(t => ({ label: t.title, value: t.id }))
                ]}
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsZenMode(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container text-on-surface-variant hover:text-on-surface text-xs font-bold transition-all cursor-pointer"
                title="开启全屏纯净专注"
              >
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span>禅模式</span>
              </button>

              <button
                onClick={toggleMiniWindow}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container text-on-surface-variant hover:text-on-surface text-xs font-bold transition-all cursor-pointer"
                title="缩小为置顶迷你胶囊窗"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span>迷你窗</span>
              </button>
            </div>
          </div>

          {/* 独立表盘组件 */}
          <PomodoroDial
            configMinutes={config.minutes}
            onSessionComplete={loadData}
          />

          {/* Controls */}
          <div className="flex items-center gap-6 shrink-0">
            {isActive && (
              <button onClick={handleStop} className="p-4 rounded-full bg-surface-container hover:bg-surface-container-highest active:scale-95 transition-all text-on-surface-variant group cursor-pointer">
                <Square className="w-5 h-5 group-hover:text-red-500 fill-current" />
              </button>
            )}

            <button
              onClick={isActive ? handlePauseResume : handleStart}
              className="w-20 h-20 rounded-full primary-gradient-button flex items-center justify-center active:scale-95 transition-all shadow-[0_8px_32px_rgba(70,72,212,0.3)] cursor-pointer"
            >
              {state.is_running
                ? <Pause className="w-8 h-8 fill-current" />
                : <Play className="w-8 h-8 fill-current ml-1" />
              }
            </button>

            {isActive && (
              <button onClick={handleSkip} className="p-4 rounded-full bg-surface-container hover:bg-surface-container-highest active:scale-95 transition-all text-on-surface-variant group cursor-pointer">
                <SkipForward className="w-5 h-5 group-hover:text-primary fill-current" />
              </button>
            )}
          </div>

          {/* Session Type Chips */}
          <div className="flex items-center justify-center flex-wrap gap-2 lg:gap-3 shrink-0">
            {typeConfigs.map(tc => (
              <button
                key={tc.type}
                onClick={() => { if (!isActive) setSelectedType(tc.type) }}
                className={cn(
                  "px-5 py-2.5 rounded-full text-sm font-medium transition-colors cursor-pointer",
                  selectedType === tc.type
                    ? "bg-primary text-white shadow-md font-bold"
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
        <div className="flex-none xl:flex-[2] bg-surface-container-low/50 rounded-[32px] p-6 lg:p-8 flex flex-col xl:h-full xl:overflow-hidden border border-white/40 shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)]">
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
          <div className="flex-1 xl:overflow-y-auto no-scrollbar">
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
                        <span className={cn("text-xs px-2 py-0.5 rounded font-bold", s.status === 'completed' ? "text-primary bg-primary/10" : "text-on-surface-variant bg-surface-container")}>
                          {s.status === 'running' ? '进行中' : s.status === 'completed' ? '完成' : '中断'}
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
            <button
              onClick={() => navigate('/stats')}
              className="text-sm font-bold text-primary hover:underline underline-offset-4 flex items-center gap-1 cursor-pointer"
            >
              查看完整专注趋势 <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
