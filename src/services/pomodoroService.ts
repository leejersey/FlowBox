/**
 * Pomodoro 服务层 — 对应架构文档 §3.1 模块3
 *
 * 状态机模式：前端维护计时状态，DB 只在 start/stop 时写入。
 * pomodoro_start / pomodoro_pause / pomodoro_resume / pomodoro_stop /
 * pomodoro_get_state / pomodoro_list_sessions / pomodoro_stats
 */

import { getDb } from './database'
import type {
  PomodoroSession,
  PomodoroState,
  PomodoroStats,
  StartPomodoroPayload,
} from '../types/pomodoro'

// ============ 前端内存状态机 ============

let timerState: PomodoroState = {
  is_running: false,
  type: 'focus',
  elapsed_seconds: 0,
  total_seconds: 0,
  related_todo_id: null,
}

let currentSessionId: number | null = null
let timerInterval: ReturnType<typeof setInterval> | null = null
let pausedAt: number | null = null
let startedAtMs: number | null = null

type TickCallback = (state: PomodoroState) => void
type CompleteCallback = (session: PomodoroSession) => void
let onTick: TickCallback | null = null
let onComplete: CompleteCallback | null = null

/** 注册回调 */
export function pomodoroOnTick(cb: TickCallback) { onTick = cb }
export function pomodoroOnComplete(cb: CompleteCallback) { onComplete = cb }

// ============ 7 个 Command ============

/** pomodoro_start — 开始番茄钟 */
export async function pomodoroStart(payload: StartPomodoroPayload): Promise<PomodoroSession> {
  if (timerState.is_running) {
    throw new Error('POMODORO_ALREADY_RUNNING: 已有计时进行中')
  }

  const db = await getDb()
  const now = new Date().toISOString()
  const totalSeconds = payload.duration_minutes * 60

  const result = await db.execute(
    `INSERT INTO pomodoro_sessions (type, duration_minutes, status, related_todo_id, started_at)
     VALUES ($1, $2, 'completed', $3, $4)`,
    [payload.type, payload.duration_minutes, payload.related_todo_id ?? null, now]
  )

  currentSessionId = result.lastInsertId!
  startedAtMs = Date.now()
  pausedAt = null

  timerState = {
    is_running: true,
    type: payload.type,
    elapsed_seconds: 0,
    total_seconds: totalSeconds,
    related_todo_id: payload.related_todo_id ?? null,
  }

  // 启动每秒 tick
  timerInterval = setInterval(() => tick(), 1000)

  const rows = await db.select<PomodoroSession[]>(
    'SELECT * FROM pomodoro_sessions WHERE id = $1', [currentSessionId]
  )
  return rows[0]
}

/** pomodoro_pause — 暂停 */
export function pomodoroPause(): PomodoroState {
  if (!timerState.is_running) {
    throw new Error('POMODORO_NOT_RUNNING: 没有进行中的计时')
  }
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
  pausedAt = Date.now()
  timerState = { ...timerState, is_running: false }
  return { ...timerState }
}

/** pomodoro_resume — 恢复 */
export function pomodoroResume(): PomodoroState {
  if (timerState.is_running || currentSessionId === null) {
    throw new Error('POMODORO_NOT_RUNNING: 无法恢复')
  }
  if (pausedAt && startedAtMs) {
    startedAtMs += Date.now() - pausedAt
  }
  pausedAt = null
  timerState = { ...timerState, is_running: true }
  timerInterval = setInterval(() => tick(), 1000)
  return { ...timerState }
}

/** pomodoro_stop — 结束番茄钟 */
export async function pomodoroStop(interrupted: boolean): Promise<PomodoroSession> {
  if (currentSessionId === null) {
    throw new Error('POMODORO_NOT_RUNNING: 没有进行中的计时')
  }

  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }

  const db = await getDb()
  const now = new Date().toISOString()
  const actualMinutes = Math.round(timerState.elapsed_seconds / 60)

  await db.execute(
    `UPDATE pomodoro_sessions
     SET status = $1, actual_minutes = $2, ended_at = $3
     WHERE id = $4`,
    [interrupted ? 'interrupted' : 'completed', actualMinutes, now, currentSessionId]
  )

  const rows = await db.select<PomodoroSession[]>(
    'SELECT * FROM pomodoro_sessions WHERE id = $1', [currentSessionId]
  )

  // 重置状态
  const session = rows[0]
  currentSessionId = null
  startedAtMs = null
  pausedAt = null
  timerState = {
    is_running: false,
    type: 'focus',
    elapsed_seconds: 0,
    total_seconds: 0,
    related_todo_id: null,
  }

  return session
}

/** pomodoro_get_state — 获取当前计时状态 */
export function pomodoroGetState(): PomodoroState {
  return { ...timerState }
}

/** pomodoro_list_sessions — 查询历史记录 */
export async function pomodoroListSessions(params: {
  date_from?: string
  date_to?: string
  limit?: number
} = {}): Promise<PomodoroSession[]> {
  const db = await getDb()
  const conditions: string[] = []
  const sqlParams: unknown[] = []
  let idx = 1

  if (params.date_from) {
    conditions.push(`started_at >= $${idx++}`)
    sqlParams.push(params.date_from)
  }
  if (params.date_to) {
    conditions.push(`started_at <= $${idx++}`)
    sqlParams.push(params.date_to)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ').replace(/started_at/g, 'p.started_at')}` : ''
  const limit = params.limit ?? 100

  return db.select<PomodoroSession[]>(
    `SELECT p.*, t.title as todo_title 
     FROM pomodoro_sessions p 
     LEFT JOIN todos t ON p.related_todo_id = t.id
     ${where} ORDER BY p.started_at DESC LIMIT $${idx}`,
    [...sqlParams, limit]
  )
}

/** pomodoro_stats — 专注统计聚合 */
export async function pomodoroStats(dateFrom: string, dateTo: string): Promise<PomodoroStats> {
  const db = await getDb()

  const summary = await db.select<{
    total: number; cnt: number; completed: number; interrupted: number
  }[]>(
    `SELECT
       COALESCE(SUM(actual_minutes), 0) as total,
       COUNT(*) as cnt,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
       SUM(CASE WHEN status = 'interrupted' THEN 1 ELSE 0 END) as interrupted
     FROM pomodoro_sessions
     WHERE type = 'focus' AND started_at >= $1 AND started_at <= $2`,
    [dateFrom, dateTo]
  )

  const daily = await db.select<{ date: string; minutes: number }[]>(
    `SELECT DATE(started_at) as date, COALESCE(SUM(actual_minutes), 0) as minutes
     FROM pomodoro_sessions
     WHERE type = 'focus' AND started_at >= $1 AND started_at <= $2
     GROUP BY DATE(started_at) ORDER BY date`,
    [dateFrom, dateTo]
  )

  const s = summary[0] ?? { total: 0, cnt: 0, completed: 0, interrupted: 0 }

  return {
    total_focus_minutes: s.total,
    session_count: s.cnt,
    completed_count: s.completed,
    interrupted_count: s.interrupted,
    daily_breakdown: daily,
  }
}

// ============ 内部方法 ============

function tick() {
  if (!timerState.is_running || !startedAtMs) return

  timerState.elapsed_seconds = Math.floor((Date.now() - startedAtMs) / 1000)

  onTick?.({ ...timerState })

  // 自然结束
  if (timerState.elapsed_seconds >= timerState.total_seconds) {
    pomodoroStop(false).then(session => {
      onComplete?.(session)
    })
  }
}
