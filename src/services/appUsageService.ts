/**
 * App Usage 服务层 — 应用使用时长追踪
 *
 * 写入和查询 app_usage 表
 */

import { getDb } from './database'

export interface AppUsageRecord {
  id: number
  app_name: string
  app_bundle_id: string | null
  window_title: string | null
  duration_seconds: number
  recorded_date: string
  hour: number
}

export interface AppUsageSummary {
  app_name: string
  total_seconds: number
}

/** 记录一条使用时长（按小时聚合 upsert） */
export async function saveUsageTick(appName: string, durationSeconds: number): Promise<void> {
  const db = await getDb()
  const now = new Date()
  const recordedDate = now.toISOString().slice(0, 10)
  const hour = now.getHours()

  // 尝试更新已有的同一小时记录
  const existing = await db.select<AppUsageRecord[]>(
    `SELECT id FROM app_usage WHERE app_name = $1 AND recorded_date = $2 AND hour = $3`,
    [appName, recordedDate, hour]
  )

  if (existing.length > 0) {
    await db.execute(
      `UPDATE app_usage SET duration_seconds = duration_seconds + $1 WHERE id = $2`,
      [durationSeconds, existing[0].id]
    )
  } else {
    await db.execute(
      `INSERT INTO app_usage (app_name, duration_seconds, recorded_date, hour) VALUES ($1, $2, $3, $4)`,
      [appName, durationSeconds, recordedDate, hour]
    )
  }
}

/** 查询今日 Top N 应用使用时长 */
export async function getTopAppsToday(limit = 8): Promise<AppUsageSummary[]> {
  const db = await getDb()
  const today = new Date().toISOString().slice(0, 10)

  return db.select<AppUsageSummary[]>(
    `SELECT app_name, SUM(duration_seconds) as total_seconds
     FROM app_usage
     WHERE recorded_date = $1
     GROUP BY app_name
     ORDER BY total_seconds DESC
     LIMIT $2`,
    [today, limit]
  )
}

/** 查询指定日期的使用数据 */
export async function getAppUsageByDate(date: string): Promise<AppUsageSummary[]> {
  const db = await getDb()

  return db.select<AppUsageSummary[]>(
    `SELECT app_name, SUM(duration_seconds) as total_seconds
     FROM app_usage
     WHERE recorded_date = $1
     GROUP BY app_name
     ORDER BY total_seconds DESC`,
    [date]
  )
}
