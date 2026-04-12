/**
 * Dev Trending 数据类型 — 对应 006_trending.sql
 */

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
