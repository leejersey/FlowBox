/**
 * Stats 服务层 — 聚合各模块数据供统计页面使用
 */

import { getDb } from './database'
import { localDateKey, localDayBounds, localMondayStart } from '../lib/localDate'

export interface DashboardStats {
  today_focus_minutes: number
  week_pomodoro_count: number
  todo_completion_rate: number
  idea_count: number
}

export interface HourlyFocus {
  hour: number
  minutes: number
}

export interface FocusTrend {
  date: string
  minutes: number
}

export interface UsageDistribution {
  name: string
  value: number
  color: string
}

/** 获取仪表盘 KPI 指标 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const db = await getDb()
  const { startIso, endIso } = localDayBounds()

  // 今日专注时长
  const focusRows = await db.select<{ total: number }[]>(
    `SELECT COALESCE(SUM(actual_minutes), 0) as total
     FROM pomodoro_sessions
     WHERE type = 'focus' AND started_at >= $1 AND started_at < $2`,
    [startIso, endIso]
  )

  // 本周番茄数
  const weekStart = localMondayStart().toISOString()
  const pomoRows = await db.select<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM pomodoro_sessions
     WHERE type = 'focus' AND status = 'completed' AND started_at >= $1`,
    [weekStart]
  )

  // 待办完成率
  const todoRows = await db.select<{ total: number; done: number }[]>(
    `SELECT COUNT(*) as total,
            SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done
     FROM todos`
  )

  // 灵感总数
  const ideaRows = await db.select<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM ideas WHERE is_archived = 0`
  )

  const todoTotal = todoRows[0]?.total ?? 0
  const todoDone = todoRows[0]?.done ?? 0

  return {
    today_focus_minutes: focusRows[0]?.total ?? 0,
    week_pomodoro_count: pomoRows[0]?.cnt ?? 0,
    todo_completion_rate: todoTotal > 0 ? Math.round((todoDone / todoTotal) * 100) : 0,
    idea_count: ideaRows[0]?.cnt ?? 0,
  }
}

/** 获取今日每小时专注分布 */
export async function getHourlyFocus(): Promise<HourlyFocus[]> {
  const db = await getDb()
  const { startIso, endIso } = localDayBounds()

  const rows = await db.select<{ started_at: string; minutes: number }[]>(
    `SELECT started_at, COALESCE(actual_minutes, 0) as minutes
     FROM pomodoro_sessions
     WHERE type = 'focus' AND started_at >= $1 AND started_at < $2`,
    [startIso, endIso]
  )

  // 补全 24 小时
  const full: HourlyFocus[] = Array.from({ length: 24 }, (_, i) => ({ hour: i, minutes: 0 }))
  for (const r of rows) {
    full[new Date(r.started_at).getHours()].minutes += r.minutes
  }
  return full
}

/** 获取最近 N 天专注趋势 */
export async function getFocusTrend(days: number = 7): Promise<FocusTrend[]> {
  const db = await getDb()
  const today = new Date()
  const trend: FocusTrend[] = []
  
  // 生成最近 N 天的连续日期数组 (往前推)
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    trend.push({ date: localDateKey(d).slice(5), minutes: 0 }) // MM-DD
  }

  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - days + 1)
  const { startIso } = localDayBounds(startDate)
  const { endIso } = localDayBounds(today)

  const rows = await db.select<{ started_at: string; minutes: number }[]>(
    `SELECT started_at, COALESCE(actual_minutes, 0) as minutes
     FROM pomodoro_sessions
     WHERE type = 'focus' AND started_at >= $1 AND started_at < $2`,
    [startIso, endIso]
  )

  for (const r of rows) {
    const date = localDateKey(new Date(r.started_at)).slice(5)
    const t = trend.find(x => x.date === date)
    if (t) t.minutes += r.minutes
  }
  return trend
}

/** 获取今日应用使用分布（来自 app_usage 表的真实数据） */
export async function getUsageDistribution(): Promise<UsageDistribution[]> {
  const db = await getDb()
  const today = localDateKey()

  const APP_COLORS = [
    '#4F46E5', // indigo
    '#EAB308', // yellow
    '#10B981', // green
    '#F43F5E', // rose
    '#8B5CF6', // violet
    '#06B6D4', // cyan
    '#F97316', // orange
    '#EC4899', // pink
  ]

  const rows = await db.select<{ app_name: string; total: number }[]>(
    `SELECT app_name, SUM(duration_seconds) as total
     FROM app_usage
     WHERE recorded_date = $1
     GROUP BY app_name
     ORDER BY total DESC
     LIMIT 8`,
    [today]
  )

  if (rows.length === 0) {
    // 如果 app_usage 表没数据，回退到模块计数
    const [todo, idea, voice, pomo] = await Promise.all([
      db.select<{ cnt: number }[]>(`SELECT COUNT(*) as cnt FROM todos`),
      db.select<{ cnt: number }[]>(`SELECT COUNT(*) as cnt FROM ideas`),
      db.select<{ cnt: number }[]>(`SELECT COUNT(*) as cnt FROM voice_records`),
      db.select<{ cnt: number }[]>(`SELECT COUNT(*) as cnt FROM pomodoro_sessions`),
    ])

    return [
      { name: '待办', value: todo[0]?.cnt ?? 0, color: '#4F46E5' },
      { name: '灵感', value: idea[0]?.cnt ?? 0, color: '#EAB308' },
      { name: '语音', value: voice[0]?.cnt ?? 0, color: '#10B981' },
      { name: '番茄记录', value: pomo[0]?.cnt ?? 0, color: '#F43F5E' },
    ].filter(d => d.value > 0)
  }

  return rows.map((row, idx) => ({
    name: row.app_name,
    value: Math.round(row.total / 60), // 转为分钟
    color: APP_COLORS[idx % APP_COLORS.length],
  }))
}
