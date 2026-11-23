/**
 * Butler DB Service — 多会话对话历史 SQLite 持久化
 * 内存优先策略：流式输出时仅更新内存，完成后一次性落盘
 */

import { getDb } from './database'
import type { ChatMessage, ButlerRequestContext, ButlerSession } from '@/types/butler'
import { DEFAULT_SESSION_TITLE, deriveSessionTitle } from '@/lib/butlerSession'

export const DEFAULT_SESSION_ID = 'default'

// ─── Sessions ───────────────────────────────────

export async function loadSessions(): Promise<ButlerSession[]> {
  const db = await getDb()
  return db.select<ButlerSession[]>(
    'SELECT id, title, updated_at, created_at FROM butler_sessions ORDER BY updated_at DESC',
  )
}

export async function upsertSession(session: ButlerSession): Promise<void> {
  const db = await getDb()
  await db.execute(
    `INSERT INTO butler_sessions (id, title, updated_at, created_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT(id) DO UPDATE SET title = excluded.title, updated_at = excluded.updated_at`,
    [session.id, session.title, session.updated_at, session.created_at],
  )
}

export async function deleteSession(sessionId: string): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM butler_messages WHERE COALESCE(session_id, \'default\') = $1', [sessionId])
  await db.execute('DELETE FROM butler_sessions WHERE id = $1', [sessionId])
}

// ─── Messages ───────────────────────────────────

export async function loadMessages(sessionId: string = DEFAULT_SESSION_ID): Promise<ChatMessage[]> {
  const db = await getDb()
  return db.select<ChatMessage[]>(
    `SELECT id, role, content, timestamp, COALESCE(session_id, 'default') AS session_id
     FROM butler_messages
     WHERE COALESCE(session_id, 'default') = $1
     ORDER BY timestamp ASC`,
    [sessionId],
  )
}

export async function saveMessage(msg: ChatMessage, sessionId: string = DEFAULT_SESSION_ID): Promise<void> {
  const db = await getDb()
  const targetSessionId = msg.session_id || sessionId
  await db.execute(
    'INSERT OR REPLACE INTO butler_messages (id, role, content, timestamp, session_id) VALUES ($1, $2, $3, $4, $5)',
    [msg.id, msg.role, msg.content, msg.timestamp, targetSessionId],
  )
}

export async function deleteAllMessages(sessionId?: string): Promise<void> {
  const db = await getDb()
  if (sessionId) {
    await db.execute('DELETE FROM butler_messages WHERE COALESCE(session_id, \'default\') = $1', [sessionId])
  } else {
    await db.execute('DELETE FROM butler_messages')
  }
}

// ─── State (key-value) ──────────────────────────

export async function loadStateValue(key: string): Promise<string | null> {
  const db = await getDb()
  const rows = await db.select<{ value: string }[]>(
    'SELECT value FROM butler_state WHERE key = $1',
    [key],
  )
  return rows.length > 0 ? rows[0].value : null
}

export async function saveStateValue(key: string, value: string): Promise<void> {
  const db = await getDb()
  await db.execute(
    `INSERT INTO butler_state (key, value, updated_at) VALUES ($1, $2, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    [key, value],
  )
}

export async function deleteAllState(): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM butler_state')
}

// ─── Compound loaders ───────────────────────────

export async function loadButlerState(): Promise<{
  sessions: ButlerSession[]
  activeSessionId: string
  messages: ChatMessage[]
  currentModel: string
  promptTemplate: string
  lastRequest: ButlerRequestContext | null
}> {
  const [rawSessions, savedActiveSessionId, model, prompt, lastReq] = await Promise.all([
    loadSessions(),
    loadStateValue('activeSessionId'),
    loadStateValue('currentModel'),
    loadStateValue('promptTemplate'),
    loadStateValue('lastRequest'),
  ])

  let sessions = rawSessions
  if (sessions.length === 0) {
    const legacyMessages = await loadMessages(DEFAULT_SESSION_ID)
    const now = Date.now()
    const firstUserMsg = legacyMessages.find(m => m.role === 'user')
    const defaultSession: ButlerSession = {
      id: DEFAULT_SESSION_ID,
      title: firstUserMsg ? deriveSessionTitle(firstUserMsg.content) : DEFAULT_SESSION_TITLE,
      created_at: legacyMessages[0]?.timestamp ?? now,
      updated_at: legacyMessages[legacyMessages.length - 1]?.timestamp ?? now,
    }
    await upsertSession(defaultSession)
    sessions = [defaultSession]
  }

  const activeSessionId = savedActiveSessionId && sessions.some(s => s.id === savedActiveSessionId)
    ? savedActiveSessionId
    : sessions[0].id

  const messages = await loadMessages(activeSessionId)

  let lastRequest: ButlerRequestContext | null = null
  if (lastReq) {
    try { lastRequest = JSON.parse(lastReq) } catch { /* ignore */ }
  }

  return {
    sessions,
    activeSessionId,
    messages,
    currentModel: model ?? 'DeepSeek - deepseek-chat',
    promptTemplate: prompt ?? '默认助手',
    lastRequest,
  }
}
