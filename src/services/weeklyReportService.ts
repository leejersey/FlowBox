/**
 * AI 周报生成服务 — 聚合本周真实待办、番茄专注、灵感与 GitHub 热点数据
 */

import * as statsService from './statsService'
import * as todoService from './todoService'
import * as ideaService from './ideaService'
import * as trendingService from './trendingService'
import * as settingsService from './settingsService'
import * as aiService from './aiService'
import { exportMarkdownToObsidian } from './obsidianService'
import { localDateKey } from '@/lib/localDate'

export type WeeklyReportStyle = 'work' | 'obsidian'

export async function generateWeeklyReport(style: WeeklyReportStyle): Promise<string> {
  const [stats, trend, todos, ideas, trending] = await Promise.all([
    statsService.getDashboardStats(),
    statsService.getFocusTrend(7),
    todoService.todoList({ limit: 40 }),
    ideaService.ideaList({ limit: 15, is_archived: false }),
    trendingService.getLatestTrendingList('past_week'),
  ])

  const totalWeekFocusMinutes = trend.reduce((acc, item) => acc + item.minutes, 0)
  const doneTodos = todos.filter(t => t.status === 'done').slice(0, 15)
  const activeTodos = todos.filter(t => t.status !== 'done').slice(0, 10)
  const recentIdeas = ideas.slice(0, 8)
  const topRepos = trending.slice(0, 5)

  const styleGuide =
    style === 'work'
      ? `请以「简洁专业的职场周报」风格撰写（适合直接发飞书/钉钉/团队群）：
1. **本周核心产出**（按已完成事项归纳，突出结果而非流水账）
2. **专注与效率数据**（简明列出本周专注时长、番茄数与待办完成率）
3. **下周重点计划**（基于当前待处理与进行中的高优事项）
4. **风险与建议**（如有滞留高优事项则温和指出）`
      : `请以「深度个人复盘日志」风格撰写（适合直接归档到 Obsidian）：
1. **本周高光与复盘**（结合已完成待办与专注曲线做节奏复盘）
2. **灵感沉淀与技术雷达**（串联本周灵感便签与关注的 GitHub 开源热点）
3. **下周心流目标**（给出 3 条聚焦行动建议）`

  const contextData = [
    `日期：${localDateKey()}`,
    `近 7 天总专注时长：${totalWeekFocusMinutes} 分钟（本周完成番茄 ${stats.week_pomodoro_count} 个，待办总体完成率 ${stats.todo_completion_rate}%，灵感累计 ${stats.idea_count} 条）`,
    `已完成待办（${doneTodos.length} 条）：\n${doneTodos.map(t => `- ${t.title}`).join('\n') || '暂无'}`,
    `进行中/待处理待办（${activeTodos.length} 条）：\n${activeTodos.map(t => `- [P${t.priority}][${t.status}] ${t.title}`).join('\n') || '暂无'}`,
    `近期灵感（${recentIdeas.length} 条）：\n${recentIdeas.map(i => `- ${i.content.replace(/\s+/g, ' ').slice(0, 100)}`).join('\n') || '暂无'}`,
    `本周关注 GitHub 热点：\n${topRepos.map(r => `- ${r.repo_name}: ${r.ai_summary_zh || r.description}`).join('\n') || '暂无'}`,
  ].join('\n\n')

  return aiService.chatWithAssistant({
    input: `${styleGuide}\n\n以下是本周 FlowBox 本地真实数据：\n\n${contextData}`,
    temperature: 0.4,
  })
}

export async function exportWeeklyReport(markdown: string): Promise<'obsidian' | 'clipboard'> {
  const vaultPath = (await settingsService.settingsGet('obsidian.vault_path'))?.trim()
  if (vaultPath) {
    const fileName = `${localDateKey()} FlowBox 本周复盘周报.md`
    await exportMarkdownToObsidian({ vaultPath, fileName, markdownText: markdown })
    return 'obsidian'
  }
  await navigator.clipboard.writeText(markdown)
  return 'clipboard'
}
