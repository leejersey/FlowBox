/**
 * Settings 服务层 — 对应架构文档 §3.1 模块6
 *
 * settings_get / settings_set / settings_get_all
 */

import { getDb } from './database'
import type { Setting } from '../types/settings'

/** settings_get — 读取单个设置 */
export async function settingsGet(key: string): Promise<string | null> {
  const db = await getDb()
  const rows = await db.select<Setting[]>(
    'SELECT value FROM settings WHERE key = $1',
    [key]
  )
  return rows.length > 0 ? rows[0].value : null
}

/** settings_set — 写入设置（upsert） */
export async function settingsSet(key: string, value: string): Promise<void> {
  const db = await getDb()
  const now = new Date().toISOString()
  await db.execute(
    `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, $3)
     ON CONFLICT(key) DO UPDATE SET value = $2, updated_at = $3`,
    [key, value, now]
  )
}

/** settings_get_all — 读取所有设置 */
export async function settingsGetAll(): Promise<Record<string, string>> {
  const db = await getDb()
  const rows = await db.select<Setting[]>('SELECT key, value FROM settings')
  const result: Record<string, string> = {}
  for (const row of rows) {
    result[row.key] = row.value
  }
  return result
}

/** 便捷方法：读取 JSON 格式的设置值 */
export async function settingsGetJson<T>(key: string, defaultValue: T): Promise<T> {
  const raw = await settingsGet(key)
  if (raw === null) return defaultValue
  try {
    return JSON.parse(raw) as T
  } catch {
    return defaultValue
  }
}

/** 便捷方法：写入 JSON 格式的设置值 */
export async function settingsSetJson<T>(key: string, value: T): Promise<void> {
  await settingsSet(key, JSON.stringify(value))
}
