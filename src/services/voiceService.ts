/**
 * Voice 服务层
 *
 * voice_list / voice_create / voice_update / voice_delete
 */

import { getDb } from './database'
import type { VoiceRecord } from '../types/voice'

/** voice_list — 查询语音记录列表 */
export async function voiceList(limit = 50): Promise<VoiceRecord[]> {
  const db = await getDb()
  return db.select<VoiceRecord[]>(
    'SELECT * FROM voice_records ORDER BY created_at DESC LIMIT $1',
    [limit]
  )
}

/** voice_create — 创建语音记录 */
export async function voiceCreate(audioPath: string, durationSeconds: number): Promise<VoiceRecord> {
  const db = await getDb()
  const now = new Date().toISOString()

  const result = await db.execute(
    `INSERT INTO voice_records (audio_path, duration_seconds, status, created_at) VALUES ($1, $2, 'recording', $3)`,
    [audioPath, durationSeconds, now]
  )

  const rows = await db.select<VoiceRecord[]>('SELECT * FROM voice_records WHERE id = $1', [result.lastInsertId])
  return rows[0]
}

/** voice_update — 更新语音记录（转写结果等） */
export async function voiceUpdate(id: number, data: {
  transcript?: string
  ai_summary?: string
  ai_todos?: string[]
  status?: VoiceRecord['status']
  duration_seconds?: number
}): Promise<VoiceRecord> {
  const db = await getDb()
  const sets: string[] = []
  const params: unknown[] = []
  let idx = 1

  if (data.transcript !== undefined) { sets.push(`transcript = $${idx++}`); params.push(data.transcript) }
  if (data.ai_summary !== undefined) { sets.push(`ai_summary = $${idx++}`); params.push(data.ai_summary) }
  if (data.ai_todos !== undefined) { sets.push(`ai_todos = $${idx++}`); params.push(JSON.stringify(data.ai_todos)) }
  if (data.status !== undefined) { sets.push(`status = $${idx++}`); params.push(data.status) }
  if (data.duration_seconds !== undefined) { sets.push(`duration_seconds = $${idx++}`); params.push(data.duration_seconds) }

  if (sets.length > 0) {
    params.push(id)
    await db.execute(`UPDATE voice_records SET ${sets.join(', ')} WHERE id = $${idx}`, params)
  }

  const rows = await db.select<VoiceRecord[]>('SELECT * FROM voice_records WHERE id = $1', [id])
  return rows[0]
}

/** voice_delete — 删除语音记录 */
export async function voiceDelete(id: number): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM voice_records WHERE id = $1', [id])
}
