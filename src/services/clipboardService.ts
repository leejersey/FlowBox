/**
 * Clipboard 服务层
 *
 * clip_list / clip_create / clip_delete / clip_toggle_pin / clip_clear
 */

import { getDb } from './database'
import type { ClipboardItem } from '../types/clipboard'

/** clip_list — 查询剪贴板历史 */
export async function clipList(params: {
  content_type?: string
  is_pinned?: boolean
  keyword?: string
  limit?: number
} = {}): Promise<ClipboardItem[]> {
  const db = await getDb()
  const conditions: string[] = []
  const sqlParams: unknown[] = []
  let idx = 1

  if (params.content_type) {
    conditions.push(`content_type = $${idx++}`)
    sqlParams.push(params.content_type)
  }
  if (params.is_pinned !== undefined) {
    conditions.push(`is_pinned = $${idx++}`)
    sqlParams.push(params.is_pinned ? 1 : 0)
  }
  if (params.keyword) {
    conditions.push(`(text_content LIKE $${idx} OR ocr_text LIKE $${idx})`)
    sqlParams.push(`%${params.keyword}%`)
    idx++
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = params.limit ?? 100

  return db.select<ClipboardItem[]>(
    `SELECT * FROM clipboard_items ${where} ORDER BY is_pinned DESC, created_at DESC LIMIT $${idx}`,
    [...sqlParams, limit]
  )
}

/** clip_create — 添加剪贴板条目 */
export async function clipCreate(data: {
  content_type: 'text' | 'code' | 'image'
  text_content?: string
  image_path?: string
  content_hash: string
  category?: string
}): Promise<ClipboardItem> {
  const db = await getDb()
  const now = new Date().toISOString()

  const result = await db.execute(
    `INSERT OR IGNORE INTO clipboard_items (content_type, text_content, image_path, content_hash, category, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [data.content_type, data.text_content ?? null, data.image_path ?? null, data.content_hash, data.category ?? null, now]
  )

  if (!result.lastInsertId) {
    // 如果已存在(hash重复)，更新时间
    await db.execute('UPDATE clipboard_items SET created_at = $1 WHERE content_hash = $2', [now, data.content_hash])
    const rows = await db.select<ClipboardItem[]>('SELECT * FROM clipboard_items WHERE content_hash = $1', [data.content_hash])
    return rows[0]
  }

  const rows = await db.select<ClipboardItem[]>('SELECT * FROM clipboard_items WHERE id = $1', [result.lastInsertId])
  return rows[0]
}

/** clip_toggle_pin — 切换置顶 */
export async function clipTogglePin(id: number): Promise<void> {
  const db = await getDb()
  await db.execute('UPDATE clipboard_items SET is_pinned = CASE WHEN is_pinned = 0 THEN 1 ELSE 0 END WHERE id = $1', [id])
}

/** clip_delete — 删除单条 */
export async function clipDelete(id: number): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM clipboard_items WHERE id = $1', [id])
}

/** clip_clear — 清除所有未置顶的历史 */
export async function clipClear(): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM clipboard_items WHERE is_pinned = 0')
}

/** clip_update_category — 更新 AI 分类 */
export async function clipUpdateCategory(id: number, category: string): Promise<void> {
  const db = await getDb()
  await db.execute('UPDATE clipboard_items SET category = $1 WHERE id = $2', [category, id])
}
