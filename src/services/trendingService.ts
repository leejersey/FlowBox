/**
 * Trending 服务层 — Dev Trending 核心业务逻辑
 *
 * API 数据获取 + 本地缓存 + AI 摘要批量生成 + 收藏到灵感
 */

import { getDb } from './database'
import * as settingsService from './settingsService'
import * as aiService from './aiService'
import * as ideaService from './ideaService'
import type { TrendingRepo, OSSInsightResponse } from '../types/trending'

// ─── 常量 ──────────────────────────────────────────

const OSS_INSIGHT_API = 'https://api.ossinsight.io/v1/trends/repos'
const SETTINGS_KEY_LAST_FETCHED = 'trending.last_fetched'

// ─── 刷新检查 ──────────────────────────────────────

/** 检查今天是否已刷新过数据 */
export async function needsRefresh(): Promise<boolean> {
  const lastFetched = await settingsService.settingsGet(SETTINGS_KEY_LAST_FETCHED)
  if (!lastFetched) return true

  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  return lastFetched !== today
}

// ─── API 数据获取 ──────────────────────────────────

/** 从 OSS Insight API 获取热门仓库 */
async function fetchFromOSSInsight(language: string = 'All'): Promise<OSSInsightResponse> {
  const url = `${OSS_INSIGHT_API}?period=past_week&language=${encodeURIComponent(language)}`

  const resp = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(15000), // 15 秒超时
  })

  if (!resp.ok) {
    throw new Error(`OSS Insight API 请求失败 (${resp.status})`)
  }

  return resp.json()
}

// ─── 缓存写入 ──────────────────────────────────────

/** 将 API 数据写入本地 SQLite */
async function cacheTrendingRepos(data: OSSInsightResponse): Promise<void> {
  const db = await getDb()
  const today = new Date().toISOString().slice(0, 10)
  const rows = data.data?.rows ?? []

  for (const row of rows) {
    // 将 contributor_logins 转为 JSON 数组
    const contributors = row.contributor_logins
      ? JSON.stringify(row.contributor_logins.split(',').map(s => s.trim()).filter(Boolean))
      : '[]'

    await db.execute(
      `INSERT INTO trending_repos (repo_id, repo_name, description, language, stars, forks, pull_requests, total_score, contributors, period, fetched_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT(repo_id, fetched_date) DO UPDATE SET
         repo_name = $2, description = $3, language = $4, stars = $5,
         forks = $6, pull_requests = $7, total_score = $8, contributors = $9`,
      [
        String(row.repo_id),
        row.repo_name,
        row.description ?? '',
        row.language ?? '',
        row.stars,
        row.forks,
        row.pull_requests,
        row.total_score,
        contributors,
        'past_week',
        today,
      ]
    )
  }

  // 记录最后获取日期
  await settingsService.settingsSet(SETTINGS_KEY_LAST_FETCHED, today)
}

// ─── 组合函数 ──────────────────────────────────────

/** 从 API 获取并缓存到本地 */
export async function fetchAndCacheTrending(language: string = 'All'): Promise<void> {
  const data = await fetchFromOSSInsight(language)
  await cacheTrendingRepos(data)
}

// ─── 本地读取 ──────────────────────────────────────

/** 从本地缓存读取热门仓库列表 */
export async function getTrendingList(date?: string): Promise<TrendingRepo[]> {
  const db = await getDb()
  const targetDate = date ?? new Date().toISOString().slice(0, 10)

  return db.select<TrendingRepo[]>(
    `SELECT * FROM trending_repos WHERE fetched_date = $1 ORDER BY total_score DESC`,
    [targetDate]
  )
}

/** 获取最近一次的数据（即使不是今天的） */
export async function getLatestTrendingList(): Promise<TrendingRepo[]> {
  const db = await getDb()

  return db.select<TrendingRepo[]>(
    `SELECT * FROM trending_repos
     WHERE fetched_date = (SELECT MAX(fetched_date) FROM trending_repos)
     ORDER BY total_score DESC`
  )
}

// ─── AI 摘要 ──────────────────────────────────────

/** 批量生成中文摘要（batch prompt） */
export async function generateAiSummaries(repos: TrendingRepo[]): Promise<void> {
  // 筛选需要生成摘要的仓库（最多 20 条）
  const needSummary = repos.filter(r => !r.ai_summary_zh).slice(0, 20)
  if (needSummary.length === 0) return

  // 拼接 batch prompt
  const repoList = needSummary
    .map((r, i) => `${i + 1}. ${r.repo_name} - ${r.description || '(no description)'}`)
    .join('\n')

  const prompt = `你是一个技术新闻编辑。请为以下 GitHub 热门开源项目各生成一句简洁的中文介绍（15-30字），突出项目的核心价值和适用场景。

请严格按 JSON 数组格式返回，每项对应一个摘要，数量与输入一致：
["摘要1", "摘要2", ...]

项目列表：
${repoList}`

  const result = await aiService.chatWithAssistant({
    input: prompt,
    temperature: 0.3,
  })

  // 解析返回的 JSON 数组
  let summaries: string[]
  try {
    // 尝试提取 JSON 数组（可能被包裹在 markdown 代码块中）
    const jsonMatch = result.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('未找到 JSON 数组')
    summaries = JSON.parse(jsonMatch[0])
  } catch {
    console.warn('AI 摘要解析失败，跳过:', result.slice(0, 200))
    return
  }

  // 逐条更新 ai_summary_zh
  const db = await getDb()
  for (let i = 0; i < needSummary.length && i < summaries.length; i++) {
    const summary = summaries[i]?.trim()
    if (!summary) continue

    await db.execute(
      `UPDATE trending_repos SET ai_summary_zh = $1 WHERE id = $2`,
      [summary, needSummary[i].id]
    )
  }
}

// ─── 数据清理 ──────────────────────────────────────

/** 清理超过 N 天的旧数据 */
export async function cleanOldData(keepDays: number = 7): Promise<void> {
  const db = await getDb()
  await db.execute(
    `DELETE FROM trending_repos WHERE fetched_date < date('now', $1)`,
    [`-${keepDays} days`]
  )
}

// ─── 收藏到灵感 ──────────────────────────────────

/** 一键收藏仓库到灵感速记 */
export async function saveToIdea(repo: TrendingRepo): Promise<void> {
  const lines: string[] = [
    `🔥 GitHub Trending: ${repo.repo_name}`,
    '',
    repo.description,
  ]

  if (repo.ai_summary_zh) {
    lines.push('', `🤖 AI 摘要: ${repo.ai_summary_zh}`)
  }

  lines.push(
    '',
    `⭐ ${repo.stars.toLocaleString()} | 🍴 ${repo.forks.toLocaleString()}`,
    `🔗 https://github.com/${repo.repo_name}`,
  )

  const content = lines.join('\n')
  const tags = ['github', 'trending', repo.language].filter(Boolean)

  await ideaService.ideaCreate(content, tags)
}
