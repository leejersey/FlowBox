/**
 * Todo 服务层 — 对应架构文档 §3.1 模块1 的 6 个 Command
 *
 * todo_create / todo_update / todo_delete / todo_list / todo_get / todo_batch_update_status
 */

import { getDb } from './database'
import type { Todo, CreateTodoPayload, UpdateTodoPayload, TodoListQuery } from '../types/todo'

/** todo_create — 创建待办 */
export async function todoCreate(payload: CreateTodoPayload): Promise<Todo> {
  const db = await getDb()
  const now = new Date().toISOString()
  const tags = JSON.stringify(payload.tags ?? [])

  const result = await db.execute(
    `INSERT INTO todos (title, content, priority, source, source_id, due_date, tags, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      payload.title,
      payload.content ?? '',
      payload.priority ?? 0,
      payload.source ?? 'manual',
      payload.source_id ?? null,
      payload.due_date ?? null,
      tags,
      now,
      now,
    ]
  )

  return todoGet(result.lastInsertId!)
}

/** todo_get — 获取单条待办详情 */
export async function todoGet(id: number): Promise<Todo> {
  const db = await getDb()
  const rows = await db.select<Todo[]>(
    'SELECT * FROM todos WHERE id = $1',
    [id]
  )

  if (rows.length === 0) {
    throw new Error(`NOT_FOUND: 待办 #${id} 不存在`)
  }

  return rows[0]
}

/** todo_list — 查询待办列表（支持筛选/分页） */
export async function todoList(query: TodoListQuery = {}): Promise<Todo[]> {
  const db = await getDb()
  const conditions: string[] = []
  const params: unknown[] = []
  let paramIdx = 1

  if (query.status) {
    conditions.push(`status = $${paramIdx++}`)
    params.push(query.status)
  }

  if (query.priority !== undefined) {
    conditions.push(`priority = $${paramIdx++}`)
    params.push(query.priority)
  }

  if (query.keyword) {
    conditions.push(`(title LIKE $${paramIdx} OR content LIKE $${paramIdx})`)
    params.push(`%${query.keyword}%`)
    paramIdx++
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = query.limit ?? 50
  const offset = query.offset ?? 0

  return db.select<Todo[]>(
    `SELECT * FROM todos ${where} ORDER BY priority DESC, created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
    [...params, limit, offset]
  )
}

/** todo_update — 更新待办 */
export async function todoUpdate(payload: UpdateTodoPayload): Promise<Todo> {
  const db = await getDb()
  const sets: string[] = []
  const params: unknown[] = []
  let paramIdx = 1

  if (payload.title !== undefined) {
    sets.push(`title = $${paramIdx++}`)
    params.push(payload.title)
  }
  if (payload.content !== undefined) {
    sets.push(`content = $${paramIdx++}`)
    params.push(payload.content)
  }
  if (payload.priority !== undefined) {
    sets.push(`priority = $${paramIdx++}`)
    params.push(payload.priority)
  }
  if (payload.status !== undefined) {
    sets.push(`status = $${paramIdx++}`)
    params.push(payload.status)
    // 如果标记为 done，自动设置 completed_at
    if (payload.status === 'done') {
      sets.push(`completed_at = $${paramIdx++}`)
      params.push(new Date().toISOString())
    } else {
      sets.push(`completed_at = NULL`)
    }
  }
  if (payload.due_date !== undefined) {
    sets.push(`due_date = $${paramIdx++}`)
    params.push(payload.due_date)
  }
  if (payload.tags !== undefined) {
    sets.push(`tags = $${paramIdx++}`)
    params.push(JSON.stringify(payload.tags))
  }

  if (sets.length === 0) {
    return todoGet(payload.id)
  }

  sets.push(`updated_at = $${paramIdx++}`)
  params.push(new Date().toISOString())
  params.push(payload.id)

  await db.execute(
    `UPDATE todos SET ${sets.join(', ')} WHERE id = $${paramIdx}`,
    params
  )

  return todoGet(payload.id)
}

/** todo_delete — 删除待办 */
export async function todoDelete(id: number): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM todos WHERE id = $1', [id])
}

/** todo_batch_update_status — 批量更新状态 */
export async function todoBatchUpdateStatus(
  ids: number[],
  status: 'pending' | 'in_progress' | 'done'
): Promise<void> {
  if (ids.length === 0) return

  const db = await getDb()
  const now = new Date().toISOString()
  const completedAt = status === 'done' ? now : null
  const placeholders = ids.map((_, i) => `$${i + 3}`).join(', ')

  await db.execute(
    `UPDATE todos SET status = $1, updated_at = $2, completed_at = ${completedAt ? `'${completedAt}'` : 'NULL'}
     WHERE id IN (${placeholders})`,
    [status, now, ...ids]
  )
}
