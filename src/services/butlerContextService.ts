/**
 * Butler 本地上下文聚合服务
 * 按需从 SQLite 读取剪贴板、待办、灵感、GitHub 热点与本周效能数据，供 AI Butler 精准调度
 */

import * as clipboardService from './clipboardService'
import * as todoService from './todoService'
import * as ideaService from './ideaService'
import * as trendingService from './trendingService'
import * as statsService from './statsService'
import type { ButlerContextSourceId, ButlerDraftContext } from '@/types/butler'

export interface ButlerContextOption {
  id: ButlerContextSourceId
  label: string
  hint: string
}

export const BUTLER_CONTEXT_OPTIONS: ButlerContextOption[] = [
  { id: 'clipboard', label: '@剪贴板', hint: '带入最近 5 条剪贴板文本/代码' },
  { id: 'todos', label: '@待办', hint: '带入未完成与高优先级待办' },
  { id: 'ideas', label: '@灵感', hint: '带入最近 8 条灵感便签' },
  { id: 'trending', label: '@热榜', hint: '带入当前 GitHub 热点 Top 10' },
  { id: 'weekly', label: '@本周', hint: '聚合本周专注与待办数据，适合写周报' },
]

async function loadSourceBlock(source: ButlerContextSourceId): Promise<string> {
  try {
    if (source === 'clipboard') {
      const clips = await clipboardService.clipList({ limit: 5 })
      if (clips.length === 0) return '【剪贴板】暂无记录'
      const lines = clips.map((c, idx) => {
        const body = (c.text_content || c.ocr_text || '[图片]').replace(/\s+/g, ' ').slice(0, 260)
        return `${idx + 1}. [${c.content_type}] ${body}`
      })
      return `【最近剪贴板】\n${lines.join('\n')}`
    }

    if (source === 'todos') {
      const todos = await todoService.todoList({ limit: 20 })
      const active = todos.filter(t => t.status !== 'done').slice(0, 12)
      if (active.length === 0) return '【待办】当前没有未完成待办'
      const lines = active.map(t => `- [${t.status}][P${t.priority}] ${t.title}${t.due_date ? ` (截止 ${t.due_date})` : ''}`)
      return `【未完成待办】\n${lines.join('\n')}`
    }

    if (source === 'ideas') {
      const ideas = await ideaService.ideaList({ limit: 8, is_archived: false })
      if (ideas.length === 0) return '【灵感】暂无灵感便签'
      const lines = ideas.map((item, idx) => `${idx + 1}. ${item.content.replace(/\s+/g, ' ').slice(0, 220)}`)
      return `【最近灵感】\n${lines.join('\n')}`
    }

    if (source === 'trending') {
      const repos = await trendingService.getLatestTrendingList('past_week')
      if (repos.length === 0) return '【GitHub 热点】暂无本地缓存榜单'
      const lines = repos.slice(0, 10).map((r, idx) =>
        `${idx + 1}. ${r.repo_name} (${r.language || 'Unknown'}, +${r.stars}★) — ${r.ai_summary_zh || r.description || '无简介'}`
      )
      return `【GitHub 每周高星 Top 10】\n${lines.join('\n')}`
    }

    if (source === 'weekly') {
      const [stats, todos, repos] = await Promise.all([
        statsService.getDashboardStats(),
        todoService.todoList({ limit: 30 }),
        trendingService.getLatestTrendingList('past_week'),
      ])
      const doneList = todos.filter(t => t.status === 'done').slice(0, 10).map(t => `- ${t.title}`)
      const pendingList = todos.filter(t => t.status !== 'done').slice(0, 8).map(t => `- [P${t.priority}] ${t.title}`)
      const topRepos = repos.slice(0, 5).map(r => `- ${r.repo_name}: ${r.ai_summary_zh || r.description}`)
      return [
        '【本周效能与进展汇总】',
        `- 今日专注：${stats.today_focus_minutes} 分钟 | 本周完成番茄：${stats.week_pomodoro_count} 个 | 待办完成率：${stats.todo_completion_rate}% | 灵感总数：${stats.idea_count}`,
        doneList.length > 0 ? `已完成待办：\n${doneList.join('\n')}` : '已完成待办：暂无',
        pendingList.length > 0 ? `待处理事项：\n${pendingList.join('\n')}` : '',
        topRepos.length > 0 ? `近期关注开源热点：\n${topRepos.join('\n')}` : '',
      ].filter(Boolean).join('\n')
    }
  } catch {
    return `【${source}】读取失败或当前为浏览器预览模式`
  }
  return ''
}

/** 并行组装已挂载的本地工作区上下文 */
export async function buildLocalContextPrompt(
  sources: ButlerContextSourceId[],
  draftContext: ButlerDraftContext | null,
): Promise<string> {
  const blocks: string[] = []

  if (draftContext) {
    blocks.push(`【当前聚焦上下文：${draftContext.title}】\n${draftContext.content.slice(0, 3200)}`)
  }

  if (sources.length > 0) {
    const loaded = await Promise.all(sources.map(loadSourceBlock))
    blocks.push(...loaded.filter(Boolean))
  }

  return blocks.join('\n\n')
}
