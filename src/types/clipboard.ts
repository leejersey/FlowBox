/**
 * Clipboard 数据类型 — 对应架构文档 §2.1 表4
 */

export interface ClipboardItem {
  id: number
  content_type: 'text' | 'code' | 'image'
  text_content: string | null
  image_path: string | null
  ocr_text: string | null
  category: string | null
  tags: string
  is_pinned: number
  content_hash: string
  created_at: string
}
