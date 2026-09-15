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
import { localDateKey } from '../lib/localDate'
import { finishPomodoroFromElapsed, RECOVER_RUNNING_SESSIONS_SQL } from '../lib/pomodoroSession'
import { notifySubscribers } from '../lib/notifySubscribers'

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
let currentStartedAt: string | null = null
let stopPromise: Promise<PomodoroSession> | null = null

type TickCallback = (state: PomodoroState) => void
type CompleteCallback = (session: PomodoroSession) => void
const tickCallbacks = new Set<TickCallback>()
const completeCallbacks = new Set<CompleteCallback>()

/** 注册回调 */
export function pomodoroOnTick(cb: TickCallback) {
  tickCallbacks.add(cb)
  return () => {
    tickCallbacks.delete(cb)
  }
}

export function pomodoroOnComplete(cb: CompleteCallback) {
  completeCallbacks.add(cb)
  return () => {
    completeCallbacks.delete(cb)
  }
}

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
     VALUES ($1, $2, 'running', $3, $4)`,
    [payload.type, payload.duration_minutes, payload.related_todo_id ?? null, now]
  )

  currentSessionId = result.lastInsertId!
  startedAtMs = Date.now()
  currentStartedAt = now
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
  notifyTick()

  return {
    id: currentSessionId,
    type: payload.type,
    duration_minutes: payload.duration_minutes,
    actual_minutes: null,
    status: 'running',
    related_todo_id: payload.related_todo_id ?? null,
    ai_summary: null,
    started_at: now,
    ended_at: null,
  }
}

/** pomodoro_pause — 暂停 */
export function pomodoroPause(): PomodoroState {
  if (!timerState.is_running) {
    throw new Error('POMODORO_NOT_RUNNING: 没有进行中的计时')
  }
  refreshElapsed()
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
  pausedAt = Date.now()
  timerState = { ...timerState, is_running: false }
  notifyTick()
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
  notifyTick()
  return { ...timerState }
}

/** pomodoro_stop — 结束番茄钟 */
export function pomodoroStop(interrupted: boolean): Promise<PomodoroSession> {
  if (stopPromise) return stopPromise
  if (currentSessionId === null) {
    return Promise.reject(new Error('POMODORO_NOT_RUNNING: 没有进行中的计时'))
  }

  stopPromise = stopCurrentPomodoro(interrupted).finally(() => { stopPromise = null })
  return stopPromise
}

async function stopCurrentPomodoro(interrupted: boolean): Promise<PomodoroSession> {
  const wasRunning = timerState.is_running
  if (wasRunning) refreshElapsed()

  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }

  const endedAt = new Date()
  const { status, actualMinutes } = finishPomodoroFromElapsed(timerState.elapsed_seconds, timerState.total_seconds, interrupted)
  const now = endedAt.toISOString()
  const sessionId = currentSessionId!

  try {
    const db = await getDb()
    await db.execute(
      `UPDATE pomodoro_sessions
       SET status = $1, actual_minutes = $2, ended_at = $3
       WHERE id = $4`,
      [status, actualMinutes, now, sessionId]
    )
  } catch (error) {
    if (wasRunning) timerInterval = setInterval(() => tick(), 1000)
    throw error
  }

  // 重置状态
  const session: PomodoroSession = {
    id: sessionId,
    type: timerState.type,
    duration_minutes: timerState.total_seconds / 60,
    actual_minutes: actualMinutes,
    status,
    related_todo_id: timerState.related_todo_id,
    ai_summary: null,
    started_at: currentStartedAt!,
    ended_at: now,
  }
  currentSessionId = null
  startedAtMs = null
  currentStartedAt = null
  pausedAt = null
  timerState = {
    is_running: false,
    type: 'focus',
    elapsed_seconds: 0,
    total_seconds: 0,
    related_todo_id: null,
  }
  notifyTick()

  return session
}

/** pomodoro_get_state — 获取当前计时状态 */
export function pomodoroGetState(): PomodoroState {
  return { ...timerState }
}

/** 将上次异常退出遗留的 running 会话结算为中断。由 main window 初始化调用。 */
export async function recoverRunningSessions(): Promise<void> {
  const db = await getDb()
  const endedAt = new Date().toISOString()
  await db.execute(
    RECOVER_RUNNING_SESSIONS_SQL,
    [endedAt]
  )
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
    conditions.push(`started_at < $${idx++}`)
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
     WHERE type = 'focus' AND started_at >= $1 AND started_at < $2 AND ended_at IS NOT NULL`,
    [dateFrom, dateTo]
  )

  const rows = await db.select<{ started_at: string; minutes: number }[]>(
    `SELECT started_at, COALESCE(actual_minutes, 0) as minutes
     FROM pomodoro_sessions
     WHERE type = 'focus' AND started_at >= $1 AND started_at < $2 AND ended_at IS NOT NULL`,
    [dateFrom, dateTo]
  )
  const totals = new Map<string, number>()
  for (const row of rows) {
    const date = localDateKey(new Date(row.started_at))
    totals.set(date, (totals.get(date) ?? 0) + row.minutes)
  }
  const daily = [...totals].map(([date, minutes]) => ({ date, minutes })).sort((a, b) => a.date.localeCompare(b.date))

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

  refreshElapsed()

  notifyTick()

  // 自然结束
  if (timerState.elapsed_seconds >= timerState.total_seconds) {
    pomodoroStop(false).then(session => {
      notifyComplete(session)
    })
  }
}

function notifyTick() {
  notifySubscribers(tickCallbacks, () => ({ ...timerState }))
}

function notifyComplete(session: PomodoroSession) {
  notifySubscribers(completeCallbacks, () => ({ ...session }))
}

function refreshElapsed() {
  if (!startedAtMs) return
  timerState.elapsed_seconds = Math.min(
    timerState.total_seconds,
    Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)),
  )
}
