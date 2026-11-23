/**
 * Trending 服务层 — Dev Trending v2 核心业务逻辑
 *
 * 多周期 API 获取 + 本地 SQLite 缓存 + 规则/AI 板块分类 + README 抓取 + AI 结构化项目速读卡
 */

import { getDb } from './database'
import * as settingsService from './settingsService'
import * as aiService from './aiService'
import * as ideaService from './ideaService'
import * as todoService from './todoService'
import { exportMarkdownToObsidian } from './obsidianService'
import type {
  OSSInsightResponse,
  TrendingPeriod,
  TrendingRepo,
} from '../types/trending'
import {
  buildTrendingDigestMarkdown,
  DEFAULT_RADAR_KEYWORDS,
  inferTrendingCategory,
  normalizeCategoryId,
  parseJsonStringArray,
  parseRepoDeepDive,
  resolveRepoCategory,
} from '../lib/trendingCategory'
import { localDateKey } from '../lib/localDate'

// ─── 常量 ──────────────────────────────────────────

const OSS_INSIGHT_API = 'https://api.ossinsight.io/v1/trends/repos'
const GITHUB_API_BASE = 'https://api.github.com/repos'
const GITHUB_SEARCH_API = 'https://api.github.com/search/repositories'
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com'
const SETTINGS_KEY_RADAR = 'trending.radar_keywords'

function lastFetchedKey(period: TrendingPeriod): string {
  return `trending.last_fetched.${period}`
}

// ─── 刷新检查 ──────────────────────────────────────

/** 检查指定周期今天是否已刷新过数据 */
export async function needsRefresh(period: TrendingPeriod = 'past_week'): Promise<boolean> {
  const lastFetched = await settingsService.settingsGet(lastFetchedKey(period))
  if (!lastFetched) return true

  const today = localDateKey()
  return lastFetched !== today
}

// ─── API 数据获取 ──────────────────────────────────

/** 从 OSS Insight API 获取热门仓库 */
async function fetchFromOSSInsight(
  period: TrendingPeriod = 'past_week',
  language: string = 'All',
): Promise<OSSInsightResponse> {
  const url = `${OSS_INSIGHT_API}?period=${encodeURIComponent(period)}&language=${encodeURIComponent(language)}`

  const resp = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  })

  if (!resp.ok) {
    throw new Error(`OSS Insight API 请求失败 (${resp.status})`)
  }

  return resp.json()
}

// ─── 缓存写入 ──────────────────────────────────────

/** 将 API 数据写入本地 SQLite（保留已有 AI 摘要与 README 缓存） */
async function cacheTrendingRepos(
  data: OSSInsightResponse,
  period: TrendingPeriod,
): Promise<void> {
  const db = await getDb()
  const today = localDateKey()
  const rows = data.data?.rows ?? []

  for (const row of rows) {
    const contributors = row.contributor_logins
      ? JSON.stringify(row.contributor_logins.split(',').map(s => s.trim()).filter(Boolean))
      : '[]'
    const initialCategory = inferTrendingCategory({
      repo_name: row.repo_name,
      description: row.description,
      language: row.language,
    })

    await db.execute(
      `INSERT INTO trending_repos (
         repo_id, repo_name, description, language, stars, forks, pull_requests,
         total_score, contributors, period, fetched_date, category
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT(repo_id, period, fetched_date) DO UPDATE SET
         repo_name = $2,
         description = $3,
         language = $4,
         stars = $5,
         forks = $6,
         pull_requests = $7,
         total_score = $8,
         contributors = $9,
         category = CASE WHEN trending_repos.category IS NULL OR trending_repos.category = '' THEN $12 ELSE trending_repos.category END`,
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
        period,
        today,
        initialCategory,
      ],
    )
  }

  await settingsService.settingsSet(lastFetchedKey(period), today)
}

interface GitHubSearchRepoItem {
  id: number
  full_name: string
  description: string | null
  language: string | null
  stargazers_count: number
  forks_count: number
  open_issues_count: number
  homepage: string | null
  topics?: string[]
  owner?: { login?: string }
}

/** 从 GitHub Search API 抓取近 14 天刚开源的高星新秀黑马项目 */
async function fetchAndCacheRisingStars(): Promise<void> {
  const since = new Date()
  since.setDate(since.getDate() - 14)
  const sinceKey = localDateKey(since)
  const query = `created:>=${sinceKey} stars:>=50`
  const url = `${GITHUB_SEARCH_API}?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=30`

  const resp = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(15000),
  })

  if (!resp.ok) {
    throw new Error(`GitHub 新秀榜请求失败 (${resp.status})`)
  }

  const json = (await resp.json()) as { items?: GitHubSearchRepoItem[] }
  const items = json.items ?? []
  const db = await getDb()
  const today = localDateKey()

  for (const item of items) {
    const topics = Array.isArray(item.topics) ? item.topics.slice(0, 8) : []
    const contributors = item.owner?.login ? JSON.stringify([item.owner.login]) : '[]'
    const initialCategory = inferTrendingCategory({
      repo_name: item.full_name,
      description: item.description,
      language: item.language,
      topics,
    })
    const score = Math.round(item.stargazers_count + item.forks_count * 2 + item.open_issues_count)

    await db.execute(
      `INSERT INTO trending_repos (
         repo_id, repo_name, description, language, stars, forks, pull_requests,
         total_score, contributors, period, fetched_date, category, homepage, topics
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT(repo_id, period, fetched_date) DO UPDATE SET
         repo_name = $2,
         description = $3,
         language = $4,
         stars = $5,
         forks = $6,
         pull_requests = $7,
         total_score = $8,
         contributors = $9,
         homepage = $13,
         topics = $14,
         category = CASE WHEN trending_repos.category IS NULL OR trending_repos.category = '' THEN $12 ELSE trending_repos.category END`,
      [
        String(item.id),
        item.full_name,
        item.description ?? '',
        item.language ?? '',
        item.stargazers_count,
        item.forks_count,
        item.open_issues_count,
        score,
        contributors,
        'rising_stars',
        today,
        initialCategory,
        item.homepage?.trim() ?? '',
        JSON.stringify(topics),
      ],
    )
  }

  await settingsService.settingsSet(lastFetchedKey('rising_stars'), today)
}

// ─── 组合函数 ──────────────────────────────────────

/** 从 API 获取并缓存到本地 */
export async function fetchAndCacheTrending(
  period: TrendingPeriod = 'past_week',
  language: string = 'All',
): Promise<void> {
  if (period === 'rising_stars') {
    await fetchAndCacheRisingStars()
    return
  }
  const data = await fetchFromOSSInsight(period, language)
  await cacheTrendingRepos(data, period)
}

// ─── 本地读取 ──────────────────────────────────────

/** 从本地缓存读取指定周期的热门仓库列表 */
export async function getTrendingList(
  period: TrendingPeriod = 'past_week',
  date?: string,
): Promise<TrendingRepo[]> {
  const db = await getDb()
  const targetDate = date ?? localDateKey()

  return db.select<TrendingRepo[]>(
    `SELECT * FROM trending_repos
     WHERE period = $1 AND fetched_date = $2
     ORDER BY stars DESC, total_score DESC`,
    [period, targetDate],
  )
}

/** 获取指定周期最近一次缓存的数据 */
export async function getLatestTrendingList(
  period: TrendingPeriod = 'past_week',
): Promise<TrendingRepo[]> {
  const db = await getDb()

  return db.select<TrendingRepo[]>(
    `SELECT * FROM trending_repos
     WHERE period = $1
       AND fetched_date = (SELECT MAX(fetched_date) FROM trending_repos WHERE period = $1)
     ORDER BY stars DESC, total_score DESC`,
    [period],
  )
}

// ─── AI 批量摘要与板块分类 ─────────────────────────

interface BatchSummaryItem {
  category?: string
  summary?: string
  tags?: string[]
}

/** 批量生成中文大白话定位 + 精准板块分类 + 场景标签 */
export async function generateAiSummaries(repos: TrendingRepo[]): Promise<void> {
  const needSummary = repos.filter(r => !r.ai_summary_zh).slice(0, 20)
  if (needSummary.length === 0) return

  const repoList = needSummary
    .map((r, i) => `${i + 1}. ${r.repo_name} [${r.language || 'Unknown'}] - ${r.description || '(no description)'}`)
    .join('\n')

  const prompt = `你是一位资深开源技术编辑。请为以下 GitHub 热门项目生成结构化速览信息，帮助开发者 3 秒看懂每个项目是干什么的。

板块 category 只能从以下 7 个值中严格选择一个：
- ai（AI 大模型、Agent、MCP、RAG、多模态、推理部署等）
- devtools（CLI、IDE、编译器、构建测试、DevOps、开发效率工具）
- frontend（Web 前端框架、UI 组件库、CSS、可视化、动画）
- backend（数据库、分布式、容器、API 框架、后端基础设施）
- desktop（桌面客户端、笔记效率软件、移动端、音视频工具）
- security（网络安全、代理、认证加密、渗透测试）
- other（其他开源项目）

请严格返回 JSON 数组，数量与输入严格一致：
[
  {
    "category": "ai",
    "summary": "20-38字中文大白话定位，直接说明它做什么、解决什么痛点，不要机械直译英文",
    "tags": ["2到3个简短中文标签，如本地部署、Agent、开源替代"]
  }
]

项目列表：
${repoList}`

  const result = await aiService.chatWithAssistant({
    input: prompt,
    temperature: 0.25,
  })

  let parsedItems: (BatchSummaryItem | string)[]
  try {
    const jsonMatch = result.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('未找到 JSON 数组')
    parsedItems = JSON.parse(jsonMatch[0])
  } catch {
    console.warn('AI 摘要解析失败，跳过:', result.slice(0, 200))
    return
  }

  const db = await getDb()
  for (let i = 0; i < needSummary.length && i < parsedItems.length; i++) {
    const item = parsedItems[i]
    const target = needSummary[i]

    if (typeof item === 'string') {
      const summary = item.trim()
      if (!summary) continue
      await db.execute(
        `UPDATE trending_repos SET ai_summary_zh = $1 WHERE id = $2`,
        [summary, target.id],
      )
      continue
    }

    const summary = item?.summary?.trim()
    if (!summary) continue
    const category = normalizeCategoryId(item.category)
    const tags = Array.isArray(item.tags)
      ? item.tags.map(t => String(t).trim()).filter(Boolean).slice(0, 3)
      : []

    await db.execute(
      `UPDATE trending_repos
       SET ai_summary_zh = $1, category = $2, ai_tags = $3
       WHERE id = $4`,
      [summary, category, JSON.stringify(tags), target.id],
    )
  }
}

// ─── README 与 GitHub 元信息抓取 ───────────────────

interface GitHubRepoMeta {
  homepage?: string | null
  topics?: string[]
  default_branch?: string
}

async function fetchRawReadme(repoName: string, branches: string[]): Promise<string | null> {
  const candidates = ['README.md', 'readme.md', 'README.MD', 'Readme.md']
  for (const branch of branches) {
    for (const file of candidates) {
      try {
        const resp = await fetch(`${GITHUB_RAW_BASE}/${repoName}/${branch}/${file}`, {
          signal: AbortSignal.timeout(8000),
        })
        if (resp.ok) {
          const text = await resp.text()
          if (text.trim().length > 0) return text
        }
      } catch {
        // 继续尝试下一个候选文件名/分支
      }
    }
  }
  return null
}

function decodeBase64Utf8(base64: string): string {
  const cleaned = base64.replace(/\s+/g, '')
  const binary = atob(cleaned)
  const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0))
  return new TextDecoder('utf-8').decode(bytes)
}

/** 拉取仓库 GitHub 元信息与 README，并写入本地缓存 */
export async function fetchRepoOverview(
  repo: TrendingRepo,
  forceRefresh: boolean = false,
): Promise<TrendingRepo> {
  if (!forceRefresh && repo.readme_excerpt) {
    return repo
  }

  let homepage = repo.homepage ?? ''
  let topics = parseJsonStringArray(repo.topics)
  let defaultBranch = ''

  // 1. 尝试拉取 GitHub Repo Meta（不阻塞主流程）
  try {
    const metaResp = await fetch(`${GITHUB_API_BASE}/${repo.repo_name}`, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(8000),
    })
    if (metaResp.ok) {
      const meta = (await metaResp.json()) as GitHubRepoMeta
      if (meta.homepage) homepage = meta.homepage.trim()
      if (Array.isArray(meta.topics) && meta.topics.length > 0) topics = meta.topics.slice(0, 8)
      if (meta.default_branch) defaultBranch = meta.default_branch
    }
  } catch {
    // GitHub API 可能受限，继续用 raw 尝试拉取 README
  }

  // 2. 拉取 README 原文
  const branches = Array.from(new Set([defaultBranch, 'main', 'master'].filter(Boolean)))
  let readmeText = await fetchRawReadme(repo.repo_name, branches)

  if (!readmeText) {
    try {
      const readmeResp = await fetch(`${GITHUB_API_BASE}/${repo.repo_name}/readme`, {
        headers: { Accept: 'application/vnd.github+json' },
        signal: AbortSignal.timeout(8000),
      })
      if (readmeResp.ok) {
        const json = (await readmeResp.json()) as { content?: string; encoding?: string }
        if (json.content && json.encoding === 'base64') {
          readmeText = decodeBase64Utf8(json.content)
        }
      }
    } catch {
      // 忽略网络错误，由调用方优雅提示
    }
  }

  const excerpt = readmeText ? readmeText.slice(0, 12000) : null
  const nextCategory = repo.category || inferTrendingCategory({
    repo_name: repo.repo_name,
    description: repo.description,
    language: repo.language,
    topics,
  })

  const db = await getDb()
  await db.execute(
    `UPDATE trending_repos
     SET readme_excerpt = COALESCE($1, readme_excerpt),
         homepage = $2,
         topics = $3,
         category = $4
     WHERE id = $5`,
    [excerpt, homepage, JSON.stringify(topics), nextCategory, repo.id],
  )

  return {
    ...repo,
    readme_excerpt: excerpt ?? repo.readme_excerpt ?? null,
    homepage,
    topics: JSON.stringify(topics),
    category: nextCategory,
  }
}

// ─── AI 结构化项目速读卡 ───────────────────────────

/** 基于 README 与仓库信息生成结构化「AI 项目速读卡」 */
export async function generateRepoDeepDive(
  repo: TrendingRepo,
  forceRefresh: boolean = false,
): Promise<TrendingRepo> {
  if (!forceRefresh && parseRepoDeepDive(repo.ai_deep_dive)) {
    return repo
  }

  const enriched = repo.readme_excerpt ? repo : await fetchRepoOverview(repo)
  const topics = parseJsonStringArray(enriched.topics)
  const readmeSlice = (enriched.readme_excerpt ?? '').slice(0, 4800)

  const prompt = `你是一位擅长把复杂开源项目讲透的技术架构师。请根据以下 GitHub 项目信息与 README 节选，输出一份中文「项目速读卡」，帮助开发者在 10 秒内完全理解这个项目做了什么、值不值得用。

请严格返回如下 JSON 对象（不要额外解释）：
{
  "one_liner": "一句话大白话定位（25-45字，说清它是什么 + 面向谁）",
  "problem": "它核心解决什么痛点或场景问题（40-80字）",
  "highlights": ["核心亮点1（简洁有力）", "核心亮点2", "核心亮点3"],
  "quickstart": "技术栈、部署或快速上手方式简述（30-70字）",
  "comparison": "与同类常见工具/框架的对比或差异化优势（30-70字）"
}

项目名称：${enriched.repo_name}
编程语言：${enriched.language || '未知'}
仓库简介：${enriched.description || '无'}
Topics：${topics.join(', ') || '无'}
Stars / Forks：${enriched.stars} / ${enriched.forks}

README 节选：
${readmeSlice || '(未能拉取到 README，请基于仓库名、简介与语言进行合理归纳)'}`

  const result = await aiService.chatWithAssistant({
    input: prompt,
    temperature: 0.25,
  })

  const jsonMatch = result.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('AI 速读卡格式解析失败，请稍后重试')
  }

  const parsed = parseRepoDeepDive(jsonMatch[0])
  if (!parsed) {
    throw new Error('AI 速读卡内容不完整，请稍后重试')
  }

  const serialized = JSON.stringify(parsed)
  const db = await getDb()
  await db.execute(
    `UPDATE trending_repos
     SET ai_deep_dive = $1,
         ai_summary_zh = COALESCE(ai_summary_zh, $2)
     WHERE id = $3`,
    [serialized, parsed.one_liner, enriched.id],
  )

  return {
    ...enriched,
    ai_deep_dive: serialized,
    ai_summary_zh: enriched.ai_summary_zh || parsed.one_liner,
  }
}

// ─── 数据清理 ──────────────────────────────────────

/** 清理超过 N 天的旧数据 */
export async function cleanOldData(keepDays: number = 14): Promise<void> {
  const db = await getDb()
  await db.execute(
    `DELETE FROM trending_repos WHERE fetched_date < date('now', $1)`,
    [`-${keepDays} days`],
  )
}

// ─── 收藏到灵感 ──────────────────────────────────

/** 一键收藏仓库到灵感速记 */
export async function saveToIdea(repo: TrendingRepo): Promise<void> {
  const deepDive = parseRepoDeepDive(repo.ai_deep_dive)
  const category = resolveRepoCategory(repo)
  const lines: string[] = [
    `🔥 GitHub 热点: ${repo.repo_name}`,
    '',
    repo.description,
  ]

  if (deepDive) {
    lines.push('', `🎯 一句话定位: ${deepDive.one_liner}`)
    if (deepDive.problem) lines.push(`💡 解决痛点: ${deepDive.problem}`)
    if (deepDive.highlights.length > 0) {
      lines.push('✨ 核心亮点:', ...deepDive.highlights.map(h => `- ${h}`))
    }
  } else if (repo.ai_summary_zh) {
    lines.push('', `🤖 AI 摘要: ${repo.ai_summary_zh}`)
  }

  lines.push(
    '',
    `⭐ ${repo.stars.toLocaleString()} | 🍴 ${repo.forks.toLocaleString()}`,
    `🔗 https://github.com/${repo.repo_name}`,
  )

  const content = lines.join('\n')
  const tags = Array.from(new Set(['github', 'trending', category, repo.language].filter(Boolean)))

  await ideaService.ideaCreate(content, tags)
}

/** 一键将开源项目转为待办体验任务 */
export async function saveToTodo(repo: TrendingRepo): Promise<number> {
  const deepDive = parseRepoDeepDive(repo.ai_deep_dive)
  const category = resolveRepoCategory(repo)
  const summary = deepDive?.one_liner || repo.ai_summary_zh || repo.description || ''
  const detailLines = [
    summary,
    deepDive?.quickstart ? `上手方式：${deepDive.quickstart}` : '',
    `GitHub：https://github.com/${repo.repo_name}`,
  ].filter(Boolean)

  const created = await todoService.todoCreate({
    title: `体验开源项目：${repo.repo_name}`,
    content: detailLines.join('\n\n'),
    priority: 1,
    source: 'manual',
    tags: Array.from(new Set(['github', category, repo.language].filter(Boolean))).slice(0, 4),
  })
  return created.id
}

// ─── 技术雷达关键词设置 ────────────────────────────

export async function loadRadarKeywords(): Promise<string[]> {
  try {
    const raw = await settingsService.settingsGet(SETTINGS_KEY_RADAR)
    if (!raw) return DEFAULT_RADAR_KEYWORDS
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.map(v => String(v).trim()).filter(Boolean)
      : DEFAULT_RADAR_KEYWORDS
  } catch {
    return DEFAULT_RADAR_KEYWORDS
  }
}

export async function saveRadarKeywords(keywords: string[]): Promise<string[]> {
  const cleaned = Array.from(new Set(keywords.map(k => k.trim()).filter(Boolean))).slice(0, 20)
  await settingsService.settingsSet(SETTINGS_KEY_RADAR, JSON.stringify(cleaned))
  return cleaned
}

// ─── 导出热点周报（Obsidian / 剪贴板） ─────────────

export async function exportTrendingDigest(params: {
  periodLabel: string
  repos: TrendingRepo[]
  radarKeywords: string[]
}): Promise<{ target: 'obsidian' | 'clipboard'; filePath?: string }> {
  const today = localDateKey()
  const markdownText = buildTrendingDigestMarkdown({
    periodLabel: params.periodLabel,
    date: today,
    repos: params.repos,
    radarKeywords: params.radarKeywords,
  })

  const vaultPath = (await settingsService.settingsGet('obsidian.vault_path'))?.trim()
  if (vaultPath) {
    const fileName = `${today} GitHub ${params.periodLabel}情报.md`
    const result = await exportMarkdownToObsidian({
      vaultPath,
      fileName,
      markdownText,
    })
    return { target: 'obsidian', filePath: result.filePath }
  }

  await navigator.clipboard.writeText(markdownText)
  return { target: 'clipboard' }
}
