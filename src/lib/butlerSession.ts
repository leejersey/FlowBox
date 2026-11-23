/**
 * Butler 会话辅助纯函数
 */

export const DEFAULT_SESSION_TITLE = '新对话'

/** 根据用户首句消息自动提炼简洁会话标题 */
export function deriveSessionTitle(rawText: string, maxLen: number = 22): string {
  const lines = rawText
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)

  // 跳过第一行纯上下文标记（如 "[GitHub: xxx] @热榜"）
  const meaningfulLine = lines.find(
    line => !/^(\[[^\]]+\]|@\S+)(\s+(\[[^\]]+\]|@\S+))*$/.test(line),
  ) ?? lines[0] ?? ''

  const cleaned = meaningfulLine
    .replace(/^[#>*\-\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) return DEFAULT_SESSION_TITLE
  if (cleaned.length <= maxLen) return cleaned
  return `${cleaned.slice(0, maxLen)}…`
}
