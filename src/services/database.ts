/**
 * 数据库连接单例
 * 所有 Service 层通过此模块获取 DB 实例
 */

import type Database from '@tauri-apps/plugin-sql'

let db: Database | null = null

export async function getDb(): Promise<Database> {
  if (db) return db

  const { default: DatabaseClass } = await import('@tauri-apps/plugin-sql')
  db = await DatabaseClass.load('sqlite:flowbox.db')
  return db
}
