/**
 * Link 服务层 — 跨模块关联
 *
 * 基于 item_links 表实现任意两个实体之间的多对多关联
 */

import { getDb } from './database'

export type LinkableType = 'todo' | 'idea' | 'voice' | 'clipboard'

export interface ItemLink {
  id: number
  source_type: LinkableType
  source_id: number
  target_type: LinkableType
  target_id: number
  created_at: string
}

/** 创建关联（自动去重） */
export async function linkCreate(
  sourceType: LinkableType,
  sourceId: number,
  targetType: LinkableType,
  targetId: number
): Promise<ItemLink> {
  const db = await getDb()
  const now = new Date().toISOString()

  await db.execute(
    `INSERT OR IGNORE INTO item_links (source_type, source_id, target_type, target_id, created_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [sourceType, sourceId, targetType, targetId, now]
  )

  // 查询回来（可能已存在）
  const rows = await db.select<ItemLink[]>(
    `SELECT * FROM item_links
     WHERE source_type = $1 AND source_id = $2 AND target_type = $3 AND target_id = $4`,
    [sourceType, sourceId, targetType, targetId]
  )

  return rows[0]
}

/** 删除关联 */
export async function linkDelete(id: number): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM item_links WHERE id = $1', [id])
}

/** 查询某个实体的所有关联（双向） */
export async function linksByItem(
  type: LinkableType,
  id: number
): Promise<ItemLink[]> {
  const db = await getDb()
  return db.select<ItemLink[]>(
    `SELECT * FROM item_links
     WHERE (source_type = $1 AND source_id = $2)
        OR (target_type = $1 AND target_id = $2)
     ORDER BY created_at DESC`,
    [type, id]
  )
}

/** 查询两个实体间是否有关联 */
export async function linkBetween(
  typeA: LinkableType,
  idA: number,
  typeB: LinkableType,
  idB: number
): Promise<ItemLink | null> {
  const db = await getDb()
  const rows = await db.select<ItemLink[]>(
    `SELECT * FROM item_links
     WHERE (source_type = $1 AND source_id = $2 AND target_type = $3 AND target_id = $4)
        OR (source_type = $3 AND source_id = $4 AND target_type = $1 AND target_id = $2)
     LIMIT 1`,
    [typeA, idA, typeB, idB]
  )
  return rows[0] ?? null
}

/** 查询某个实体关联的指定类型的实体 ID 列表 */
export async function linkedIds(
  fromType: LinkableType,
  fromId: number,
  toType: LinkableType
): Promise<number[]> {
  const db = await getDb()
  const rows = await db.select<{ linked_id: number }[]>(
    `SELECT
       CASE
         WHEN source_type = $1 AND source_id = $2 THEN target_id
         ELSE source_id
       END AS linked_id
     FROM item_links
     WHERE (source_type = $1 AND source_id = $2 AND target_type = $3)
        OR (target_type = $1 AND target_id = $2 AND source_type = $3)`,
    [fromType, fromId, toType]
  )
  return rows.map(r => r.linked_id)
}
