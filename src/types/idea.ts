/**
 * Idea 数据类型 — 对应架构文档 §2.1 表2 + §3.1 模块2
 */

export interface Idea {
  id: number
  content: string
  tags: string  // JSON 数组字符串
  source: 'manual' | 'voice' | 'clipboard'
  is_archived: number  // 0 | 1
  created_at: string
}

export interface IdeaListQuery {
  keyword?: string
  is_archived?: boolean
  offset?: number
  limit?: number
}
