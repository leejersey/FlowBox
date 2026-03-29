/**
 * Pomodoro 数据类型 — 对应架构文档 §2.1 表3 + §3.1 模块3
 */

export type PomodoroType = 'focus' | 'short_break' | 'long_break'

export interface PomodoroSession {
  id: number
  type: PomodoroType
  duration_minutes: number
  actual_minutes: number | null
  status: 'completed' | 'interrupted'
  related_todo_id: number | null
  todo_title?: string | null
  ai_summary: string | null
  started_at: string
  ended_at: string | null
}

export interface PomodoroState {
  is_running: boolean
  type: PomodoroType
  elapsed_seconds: number
  total_seconds: number
  related_todo_id: number | null
}

export interface StartPomodoroPayload {
  type: PomodoroType
  duration_minutes: number
  related_todo_id?: number
}

export interface PomodoroStats {
  total_focus_minutes: number
  session_count: number
  completed_count: number
  interrupted_count: number
  daily_breakdown: { date: string; minutes: number }[]
}
