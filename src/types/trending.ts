/**
 * Dev Trending 数据类型 — 对应 006_trending.sql & 011_trending_v2.sql
 */

export type TrendingPeriod = 'past_24_hours' | 'past_week' | 'past_month'

export type TrendingSortBy = 'stars' | 'score' | 'activity'

export type TrendingCategoryId =
  | 'all'
  | 'ai'
  | 'devtools'
  | 'frontend'
  | 'backend'
  | 'desktop'
  | 'security'
  | 'other'

/** AI 生成的结构化项目速读卡 */
export interface RepoDeepDive {
  one_liner: string
  problem: string
  highlights: string[]
  quickstart: string
  comparison: string
}

/** 本地缓存的热门仓库记录 */
export interface TrendingRepo {
  id: number
  repo_id: string
  repo_name: string        // owner/repo 格式
  description: string
  language: string
  stars: number
  forks: number
  pull_requests: number
  total_score: number
  contributors: string     // JSON 数组字符串
  ai_summary_zh: string | null
  period: string
  fetched_date: string     // YYYY-MM-DD
  created_at: string
  category?: string | null
  ai_tags?: string | null       // JSON 字符串数组
  ai_deep_dive?: string | null  // JSON RepoDeepDive
  readme_excerpt?: string | null
  homepage?: string | null
  topics?: string | null        // JSON 字符串数组
}

/** OSS Insight API 返回的单条数据 */
export interface OSSInsightRow {
  repo_id: number
  repo_name: string
  description: string | null
  language: string | null
  stars: number
  forks: number
  pull_requests: number
  total_score: number
  contributor_logins: string  // 逗号分隔字符串
}

/** OSS Insight API 完整响应 */
export interface OSSInsightResponse {
  data: {
    rows: OSSInsightRow[]
  }
}
