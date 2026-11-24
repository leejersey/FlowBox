/**
 * 快速记录浮窗的文本解析：提取 `#标签`，待办取首行为标题、其余为备注
 */

export type CaptureTarget = 'idea' | 'todo'

export interface ParsedCapture {
  body: string
  tags: string[]
}

// `#` 前必须是行首或空白，避免误伤 URL 锚点、`C#` 等
const TAG_PATTERN = /(^|\s)#([^\s#]+)/g

export function parseCaptureText(text: string): ParsedCapture {
  const tags: string[] = []
  const body = text
    .replace(TAG_PATTERN, (_match, lead: string, tag: string) => {
      if (!tags.includes(tag)) tags.push(tag)
      return lead
    })
    .split('\n')
    .map(line => line.replace(/[ \t]{2,}/g, ' ').trimEnd())
    .join('\n')
    .trim()
  return { body, tags }
}

export function splitTodoText(body: string): { title: string; content: string } {
  const [first = '', ...rest] = body.split('\n')
  return { title: first.trim(), content: rest.join('\n').trim() }
}
