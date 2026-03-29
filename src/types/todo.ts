/**
 * Todo 数据类型 — 对应架构文档 §2.1 表1 + §3.1 模块1
 */

export interface Todo {
  id: number
  title: string
  content: string
  priority: 0 | 1 | 2 | 3
  status: 'pending' | 'in_progress' | 'done'
  source: 'manual' | 'voice' | 'clipboard'
  source_id: number | null
  due_date: string | null
  tags: string  // JSON 数组字符串
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface CreateTodoPayload {
  title: string
  content?: string
  priority?: 0 | 1 | 2 | 3
  due_date?: string
  tags?: string[]
  source?: 'manual' | 'voice' | 'clipboard'
  source_id?: number
}

export interface UpdateTodoPayload {
  id: number
  title?: string
  content?: string
  priority?: 0 | 1 | 2 | 3
  status?: 'pending' | 'in_progress' | 'done'
  due_date?: string | null
  tags?: string[]
}

export interface TodoListQuery {
  status?: 'pending' | 'in_progress' | 'done'
  priority?: number
  keyword?: string
  offset?: number
  limit?: number
}
