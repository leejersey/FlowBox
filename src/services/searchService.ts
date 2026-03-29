/**
 * Search 服务层 — 全局跨模块搜索
 *
 * 并行查询 todos / ideas / voice_records / clipboard_items，
 * 将结果统一为 SearchResult 按时间倒序返回
 */

import { getDb } from './database'

export type SearchResultType = 'todo' | 'idea' | 'voice' | 'clipboard'

export interface SearchResult {
  type: SearchResultType
  id: number
  title: string
  snippet: string
  created_at: string
}

/** 全局搜索（跨4张表并行 LIKE） */
export async function globalSearch(keyword: string, limit = 20): Promise<SearchResult[]> {
  if (!keyword.trim()) return []

  const db = await getDb()
  const pattern = `%${keyword.trim()}%`

  const [todos, ideas, voices, clips] = await Promise.all([
    db.select<{ id: number; title: string; content: string; created_at: string }[]>(
      `SELECT id, title, content, created_at FROM todos
       WHERE title LIKE $1 OR content LIKE $1
       ORDER BY created_at DESC LIMIT $2`,
      [pattern, limit]
    ),
    db.select<{ id: number; content: string; created_at: string }[]>(
      `SELECT id, content, created_at FROM ideas
       WHERE content LIKE $1
       ORDER BY created_at DESC LIMIT $2`,
      [pattern, limit]
    ),
    db.select<{ id: number; transcript: string; ai_summary: string; created_at: string }[]>(
      `SELECT id, transcript, ai_summary, created_at FROM voice_records
       WHERE transcript LIKE $1 OR ai_summary LIKE $1
       ORDER BY created_at DESC LIMIT $2`,
      [pattern, limit]
    ),
    db.select<{ id: number; text_content: string; category: string; created_at: string }[]>(
      `SELECT id, text_content, category, created_at FROM clipboard_items
       WHERE text_content LIKE $1 OR ocr_text LIKE $1
       ORDER BY created_at DESC LIMIT $2`,
      [pattern, limit]
    ),
  ])

  const results: SearchResult[] = []

  for (const t of todos) {
    results.push({
      type: 'todo',
      id: t.id,
      title: t.title,
      snippet: extractSnippet(t.content || t.title, keyword),
      created_at: t.created_at,
    })
  }

  for (const i of ideas) {
    results.push({
      type: 'idea',
      id: i.id,
      title: i.content.slice(0, 40) + (i.content.length > 40 ? '...' : ''),
      snippet: extractSnippet(i.content, keyword),
      created_at: i.created_at,
    })
  }

  for (const v of voices) {
    const text = v.transcript || v.ai_summary || ''
    results.push({
      type: 'voice',
      id: v.id,
      title: `语音备忘 #${v.id}`,
      snippet: extractSnippet(text, keyword),
      created_at: v.created_at,
    })
  }

  for (const c of clips) {
    const text = c.text_content || ''
    results.push({
      type: 'clipboard',
      id: c.id,
      title: c.category || '剪贴板',
      snippet: extractSnippet(text, keyword),
      created_at: c.created_at,
    })
  }

  // 按时间倒序合并排序
  results.sort((a, b) => b.created_at.localeCompare(a.created_at))

  return results.slice(0, limit)
}

/** 提取包含关键词的片段（前后各显示 30 字） */
function extractSnippet(text: string, keyword: string): string {
  if (!text) return ''
  const lowerText = text.toLowerCase()
  const lowerKey = keyword.toLowerCase()
  const idx = lowerText.indexOf(lowerKey)
  if (idx === -1) return text.slice(0, 80)

  const start = Math.max(0, idx - 30)
  const end = Math.min(text.length, idx + keyword.length + 30)
  const prefix = start > 0 ? '...' : ''
  const suffix = end < text.length ? '...' : ''
  return prefix + text.slice(start, end) + suffix
}
