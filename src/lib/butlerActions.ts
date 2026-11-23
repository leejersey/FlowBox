/**
 * Butler 可执行动作协议解析器（纯函数）
 * 从 AI 回复中提取 ```flowbox-action ... ``` 结构化块，供用户一键确认执行
 */

export type ButlerAction =
  | {
      type: 'create_todo'
      title: string
      content?: string
      priority: 0 | 1 | 2 | 3
      due_date?: string
      tags: string[]
    }
  | {
      type: 'create_idea'
      content: string
      tags: string[]
    }
  | {
      type: 'start_pomodoro'
      duration_minutes: number
      mode: 'focus' | 'short_break' | 'long_break'
      label?: string
    }

export interface ParsedButlerMessage {
  displayContent: string
  actions: ButlerAction[]
}

const ACTION_BLOCK_REGEX = /```flowbox-action\s*\n([\s\S]*?)```/gi
const UNCLOSED_ACTION_BLOCK_REGEX = /```flowbox-action[\s\S]*$/i

function normalizePriority(raw: unknown): 0 | 1 | 2 | 3 {
  const num = Number(raw)
  if (num === 1 || num === 2 || num === 3) return num
  return 0
}

function normalizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return Array.from(
    new Set(raw.map(v => String(v).trim()).filter(Boolean)),
  ).slice(0, 5)
}

function normalizeSingleAction(raw: unknown): ButlerAction | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const type = String(obj.type ?? '').trim().toLowerCase()

  if (type === 'create_todo') {
    const title = String(obj.title ?? '').trim()
    if (!title) return null
    const content = typeof obj.content === 'string' && obj.content.trim() ? obj.content.trim() : undefined
    const dueDate = typeof obj.due_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(obj.due_date.trim())
      ? obj.due_date.trim()
      : undefined
    return {
      type: 'create_todo',
      title: title.slice(0, 120),
      content,
      priority: normalizePriority(obj.priority),
      due_date: dueDate,
      tags: normalizeTags(obj.tags),
    }
  }

  if (type === 'create_idea') {
    const content = String(obj.content ?? '').trim()
    if (!content) return null
    return {
      type: 'create_idea',
      content,
      tags: normalizeTags(obj.tags),
    }
  }

  if (type === 'start_pomodoro') {
    const rawMode = String(obj.mode ?? 'focus').trim().toLowerCase()
    const mode: 'focus' | 'short_break' | 'long_break' =
      rawMode === 'short_break' || rawMode === 'long_break' ? rawMode : 'focus'
    const defaultMins = mode === 'focus' ? 25 : mode === 'short_break' ? 5 : 15
    const parsedMins = Number(obj.duration_minutes)
    const duration_minutes = Number.isFinite(parsedMins) && parsedMins >= 1 && parsedMins <= 120
      ? Math.round(parsedMins)
      : defaultMins
    const label = typeof obj.label === 'string' && obj.label.trim() ? obj.label.trim() : undefined
    return {
      type: 'start_pomodoro',
      duration_minutes,
      mode,
      label,
    }
  }

  return null
}

/**
 * 提取所有合法动作块并返回清理后的展示正文（流式未闭合块也会自动隐藏）
 */
export function extractButlerActions(markdown: string): ParsedButlerMessage {
  const actions: ButlerAction[] = []

  const withoutClosed = markdown.replace(ACTION_BLOCK_REGEX, (_full, body: string) => {
    try {
      const parsed = JSON.parse(body.trim())
      const items = Array.isArray(parsed) ? parsed : [parsed]
      for (const item of items) {
        const normalized = normalizeSingleAction(item)
        if (normalized) actions.push(normalized)
      }
    } catch {
      // 忽略格式损坏的动作块
    }
    return ''
  })

  const displayContent = withoutClosed.replace(UNCLOSED_ACTION_BLOCK_REGEX, '').trim()

  return { displayContent, actions }
}
