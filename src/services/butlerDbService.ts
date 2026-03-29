/**
 * Butler DB Service — 对话历史 SQLite 持久化
 * 内存优先策略：流式输出时仅更新内存，完成后一次性落盘
 */

import { getDb } from './database'
import type { ChatMessage, ButlerRequestContext } from '@/types/butler'

// ─── Messages ───────────────────────────────────

export async function loadMessages(): Promise<ChatMessage[]> {
  const db = await getDb()
  const rows = await db.select<ChatMessage[]>(
    'SELECT id, role, content, timestamp FROM butler_messages ORDER BY timestamp ASC'
  )
  return rows
}

export async function saveMessage(msg: ChatMessage): Promise<void> {
  const db = await getDb()
  await db.execute(
    'INSERT OR REPLACE INTO butler_messages (id, role, content, timestamp) VALUES ($1, $2, $3, $4)',
    [msg.id, msg.role, msg.content, msg.timestamp]
  )
}

export async function deleteAllMessages(): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM butler_messages')
}

// ─── State (key-value) ──────────────────────────

export async function loadStateValue(key: string): Promise<string | null> {
  const db = await getDb()
  const rows = await db.select<{ value: string }[]>(
    'SELECT value FROM butler_state WHERE key = $1',
    [key]
  )
  return rows.length > 0 ? rows[0].value : null
}

export async function saveStateValue(key: string, value: string): Promise<void> {
  const db = await getDb()
  await db.execute(
    `INSERT INTO butler_state (key, value, updated_at) VALUES ($1, $2, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    [key, value]
  )
}

export async function deleteAllState(): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM butler_state')
}

// ─── Compound loaders ───────────────────────────

export async function loadButlerState(): Promise<{
  messages: ChatMessage[]
  currentModel: string
  promptTemplate: string
  lastRequest: ButlerRequestContext | null
}> {
  const [messages, model, prompt, lastReq] = await Promise.all([
    loadMessages(),
    loadStateValue('currentModel'),
    loadStateValue('promptTemplate'),
    loadStateValue('lastRequest'),
  ])

  let lastRequest: ButlerRequestContext | null = null
  if (lastReq) {
    try { lastRequest = JSON.parse(lastReq) } catch { /* ignore */ }
  }

  return {
    messages,
    currentModel: model ?? 'DeepSeek - deepseek-chat',
    promptTemplate: prompt ?? '默认助手',
    lastRequest,
  }
}
