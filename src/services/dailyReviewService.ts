/**
 * Daily Review 服务层 — AI 每日回顾
 *
 * 聚合各模块今日数据 + 检测滞留待办 + AI 总结生成
 */

import { getDb } from './database'
import * as aiService from './aiService'
import * as settingsService from './settingsService'

// ─── 类型定义 ──────────────────────────────────────

export interface DailyReviewData {
  date: string
  todosCompleted: number
  todosTotal: number
  completionRate: number
  ideasCaptured: number
  pomodoroCount: number
  totalFocusMinutes: number
  voiceRecorded: number
  clipboardCount: number
  stalledTodos: StalledTodo[]
}

export interface StalledTodo {
  id: number
  title: string
  days: number
  priority: number
}

export interface DailyReviewReport {
  data: DailyReviewData
  aiSummary: string | null
  generatedAt: string
}

// ─── 数据聚合 ──────────────────────────────────────

/** 聚合今日各模块数据 */
export async function gatherTodayData(): Promise<DailyReviewData> {
  const db = await getDb()
  const today = new Date().toISOString().slice(0, 10)
  const todayStart = today + 'T00:00:00'
  const todayEnd = today + 'T23:59:59'

  // 今日完成的待办（包含之前创建、今天完成的）
  const completedRows = await db.select<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM todos WHERE status = 'done' AND DATE(completed_at) = $1`,
    [today]
  )

  // 所有活跃待办数
  const activeTodoRows = await db.select<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM todos WHERE status != 'done'`
  )

  const todosCompleted = completedRows[0]?.cnt ?? 0
  const todosTotal = todosCompleted + (activeTodoRows[0]?.cnt ?? 0)
  const completionRate = todosTotal > 0 ? Math.round((todosCompleted / todosTotal) * 100) : 0

  // 今日灵感
  const ideaRows = await db.select<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM ideas WHERE DATE(created_at) = $1`,
    [today]
  )

  // 今日番茄钟
  const pomoRows = await db.select<{ cnt: number; total_min: number }[]>(
    `SELECT
       COUNT(*) as cnt,
       COALESCE(SUM(actual_minutes), 0) as total_min
     FROM pomodoro_sessions
     WHERE type = 'focus' AND status = 'completed' AND started_at >= $1 AND started_at <= $2`,
    [todayStart, todayEnd]
  )

  // 今日语音
  const voiceRows = await db.select<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM voice_records WHERE DATE(created_at) = $1`,
    [today]
  )

  // 今日剪贴板
  const clipRows = await db.select<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM clipboard_items WHERE DATE(created_at) = $1`,
    [today]
  )

  // 滞留待办：高优先级且超过 3 天未处理
  const stalledRows = await db.select<StalledTodo[]>(
    `SELECT
       id, title, priority,
       CAST(julianday('now') - julianday(created_at) AS INTEGER) as days
     FROM todos
     WHERE status != 'done' AND priority >= 2
       AND julianday('now') - julianday(created_at) >= 3
     ORDER BY priority DESC, days DESC
     LIMIT 5`
  )

  return {
    date: today,
    todosCompleted,
    todosTotal,
    completionRate,
    ideasCaptured: ideaRows[0]?.cnt ?? 0,
    pomodoroCount: pomoRows[0]?.cnt ?? 0,
    totalFocusMinutes: pomoRows[0]?.total_min ?? 0,
    voiceRecorded: voiceRows[0]?.cnt ?? 0,
    clipboardCount: clipRows[0]?.cnt ?? 0,
    stalledTodos: stalledRows,
  }
}

// ─── AI 总结 ──────────────────────────────────────

const REVIEW_SYSTEM_PROMPT = `你是 FlowBox 的 AI 效率助手。用户刚结束一天的工作，请根据他今天的数据生成一份温暖、有洞察力的每日回顾。

要求：
1. 先用 2-3 句话总结今天的表现（鼓励为主，指出亮点）
2. 如果有滞留待办，温和地提醒并给出建议
3. 给出 1-2 条明天的具体行动建议
4. 语言使用中文，语气像一位关心你的智能助手
5. 不要使用 markdown 标题，用 emoji 分段即可
6. 总长控制在 150-250 字`

function buildReviewUserPrompt(data: DailyReviewData): string {
  const lines: string[] = [
    `今日日期：${data.date}`,
    ``,
    `📋 待办：今日完成 ${data.todosCompleted} 项，总共 ${data.todosTotal} 项，完成率 ${data.completionRate}%`,
    `💡 灵感：捕获 ${data.ideasCaptured} 条`,
    `🍅 番茄钟：完成 ${data.pomodoroCount} 个，共专注 ${data.totalFocusMinutes} 分钟`,
    `🎙️ 语音备忘：录制 ${data.voiceRecorded} 段`,
    `📎 剪贴板：保存 ${data.clipboardCount} 条`,
  ]

  if (data.stalledTodos.length > 0) {
    lines.push(``)
    lines.push(`⚠️ 以下高优先级待办已连续多天未处理：`)
    for (const t of data.stalledTodos) {
      lines.push(`  - "${t.title}"（优先级 ${t.priority}，已滞留 ${t.days} 天）`)
    }
  }

  lines.push(``)
  lines.push(`请根据以上数据生成今日回顾。`)

  return lines.join('\n')
}

/** 生成 AI 回顾总结 */
export async function generateAiSummary(data: DailyReviewData): Promise<string> {
  return aiService.chatWithAssistant({
    input: buildReviewUserPrompt(data),
    systemPrompt: REVIEW_SYSTEM_PROMPT,
    temperature: 0.6,
  })
}

/** 流式生成 AI 回顾总结 */
export async function generateAiSummaryStream(
  data: DailyReviewData,
  onToken: (token: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  return aiService.chatWithAssistantStream({
    input: buildReviewUserPrompt(data),
    systemPrompt: REVIEW_SYSTEM_PROMPT,
    temperature: 0.6,
    onToken,
    signal,
  })
}

// ─── 回顾历史管理 ──────────────────────────────────

const REVIEW_HISTORY_KEY = 'daily_review.history'
const LAST_SHOWN_KEY = 'daily_review.last_shown'

/** 保存回顾报告 */
export async function saveReviewReport(report: DailyReviewReport): Promise<void> {
  // 读取历史
  const raw = await settingsService.settingsGet(REVIEW_HISTORY_KEY)
  let history: DailyReviewReport[] = []
  if (raw) {
    try { history = JSON.parse(raw) } catch { /* ignore */ }
  }

  // 如果今天已有，替换
  const idx = history.findIndex(r => r.data.date === report.data.date)
  if (idx >= 0) {
    history[idx] = report
  } else {
    history.push(report)
  }

  // 只保留最近 30 天
  if (history.length > 30) {
    history = history.slice(-30)
  }

  await settingsService.settingsSet(REVIEW_HISTORY_KEY, JSON.stringify(history))
}

/** 标记今日已弹窗 */
export async function markShown(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10)
  await settingsService.settingsSet(LAST_SHOWN_KEY, today)
}

/** 检查今日是否已弹窗 */
export async function hasShownToday(): Promise<boolean> {
  const lastShown = await settingsService.settingsGet(LAST_SHOWN_KEY)
  const today = new Date().toISOString().slice(0, 10)
  return lastShown === today
}

/** 获取回顾设置 */
export async function getReviewSettings(): Promise<{ enabled: boolean; time: string }> {
  const enabled = await settingsService.settingsGet('daily_review.enabled')
  const time = await settingsService.settingsGet('daily_review.time')
  return {
    enabled: enabled !== 'false', // 默认开启
    time: time ?? '21:00',
  }
}
