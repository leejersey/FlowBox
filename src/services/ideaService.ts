/**
 * Idea 服务层 — 对应架构文档 §3.1 模块2
 *
 * idea_create / idea_update / idea_delete / idea_list / idea_archive
 */

import { getDb } from './database'
import type { Idea, IdeaListQuery } from '../types/idea'

/** idea_create — 创建灵感 */
export async function ideaCreate(content: string, tags: string[] = []): Promise<Idea> {
  const db = await getDb()
  const now = new Date().toISOString()

  const result = await db.execute(
    `INSERT INTO ideas (content, tags, created_at) VALUES ($1, $2, $3)`,
    [content, JSON.stringify(tags), now]
  )

  return ideaGet(result.lastInsertId!)
}

/** 获取单条灵感 */
async function ideaGet(id: number): Promise<Idea> {
  const db = await getDb()
  const rows = await db.select<Idea[]>('SELECT * FROM ideas WHERE id = $1', [id])
  if (rows.length === 0) throw new Error(`NOT_FOUND: 灵感 #${id} 不存在`)
  return rows[0]
}

/** idea_list — 查询灵感列表 */
export async function ideaList(query: IdeaListQuery = {}): Promise<Idea[]> {
  const db = await getDb()
  const conditions: string[] = []
  const params: unknown[] = []
  let idx = 1

  if (query.is_archived !== undefined) {
    conditions.push(`is_archived = $${idx++}`)
    params.push(query.is_archived ? 1 : 0)
  }

  if (query.keyword) {
    conditions.push(`content LIKE $${idx++}`)
    params.push(`%${query.keyword}%`)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = query.limit ?? 50
  const offset = query.offset ?? 0

  return db.select<Idea[]>(
    `SELECT * FROM ideas ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`,
    [...params, limit, offset]
  )
}

/** idea_update — 更新灵感 */
export async function ideaUpdate(
  id: number,
  data: { content?: string; tags?: string[] }
): Promise<Idea> {
  const db = await getDb()
  const sets: string[] = []
  const params: unknown[] = []
  let idx = 1

  if (data.content !== undefined) {
    sets.push(`content = $${idx++}`)
    params.push(data.content)
  }
  if (data.tags !== undefined) {
    sets.push(`tags = $${idx++}`)
    params.push(JSON.stringify(data.tags))
  }

  if (sets.length > 0) {
    params.push(id)
    await db.execute(
      `UPDATE ideas SET ${sets.join(', ')} WHERE id = $${idx}`,
      params
    )
  }

  return ideaGet(id)
}

/** idea_delete — 删除灵感 */
export async function ideaDelete(id: number): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM ideas WHERE id = $1', [id])
}

/** idea_archive — 归档/取消归档 */
export async function ideaArchive(id: number, isArchived: boolean): Promise<void> {
  const db = await getDb()
  await db.execute(
    'UPDATE ideas SET is_archived = $1 WHERE id = $2',
    [isArchived ? 1 : 0, id]
  )
}
