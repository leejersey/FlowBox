/**
 * Voice 数据类型 — 对应架构文档 §2.1 表5
 */

export interface VoiceRecord {
  id: number
  audio_path: string
  duration_seconds: number
  transcript: string | null
  ai_summary: string | null
  ai_todos: string | null   // JSON 数组字符串
  status: 'recording' | 'processing' | 'done' | 'error'
  created_at: string
}
