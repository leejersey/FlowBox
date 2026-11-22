import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  inferTrendingCategory,
  normalizeCategoryId,
  parseRepoDeepDive,
  sortTrendingRepos,
} from '../src/lib/trendingCategory.ts'

test('规则分类器能准确识别常见开源项目板块', () => {
  assert.equal(
    inferTrendingCategory({ repo_name: 'openai/codex-agent', description: 'Autonomous coding agent with MCP support', language: 'TypeScript' }),
    'ai',
  )
  assert.equal(
    inferTrendingCategory({ repo_name: 'shadcn-ui/ui', description: 'Beautifully designed React components built with Tailwind CSS', language: 'TypeScript' }),
    'frontend',
  )
  assert.equal(
    inferTrendingCategory({ repo_name: 'duckdb/duckdb', description: 'In-process SQL OLAP database management system', language: 'C++' }),
    'backend',
  )
  assert.equal(
    inferTrendingCategory({ repo_name: 'SagerNet/sing-box', description: 'The universal proxy platform', language: 'Go' }),
    'security',
  )
  assert.equal(
    inferTrendingCategory({ repo_name: 'example/unknown-repo', description: 'Just a demo', language: 'Rust' }),
    'other',
  )
})

test('normalizeCategoryId 对非法值安全回退为 other', () => {
  assert.equal(normalizeCategoryId('AI'), 'ai')
  assert.equal(normalizeCategoryId('devtools'), 'devtools')
  assert.equal(normalizeCategoryId('unknown_cat'), 'other')
  assert.equal(normalizeCategoryId(null), 'other')
})

test('sortTrendingRepos 支持按高星、热度与活跃度排序', () => {
  const sample = [
    { id: 1, stars: 300, total_score: 900, pull_requests: 5, forks: 10 },
    { id: 2, stars: 800, total_score: 500, pull_requests: 2, forks: 20 },
    { id: 3, stars: 200, total_score: 400, pull_requests: 50, forks: 80 },
  ]
  assert.deepEqual(sortTrendingRepos(sample, 'stars').map(r => r.id), [2, 1, 3])
  assert.deepEqual(sortTrendingRepos(sample, 'score').map(r => r.id), [1, 2, 3])
  assert.deepEqual(sortTrendingRepos(sample, 'activity').map(r => r.id), [3, 2, 1])
})

test('parseRepoDeepDive 正确解析结构化项目速读卡并容错非法输入', () => {
  const parsed = parseRepoDeepDive(JSON.stringify({
    one_liner: '轻量级本地 AI 提效工具箱',
    problem: '解决多工具割裂与隐私泄露痛点',
    highlights: ['本地 SQLite', '快捷键心流', 'AI 速读'],
    quickstart: '下载 DMG 开箱即用',
    comparison: '比 Raycast 更聚焦中文与本地知识沉淀',
  }))
  assert.ok(parsed)
  assert.equal(parsed.one_liner, '轻量级本地 AI 提效工具箱')
  assert.equal(parsed.highlights.length, 3)
  assert.equal(parseRepoDeepDive('not-json'), null)
})

test('011_trending_v2 迁移已注册且 Tauri CSP 放通 GitHub 接口', async () => {
  const [libRs, tauriConf] = await Promise.all([
    readFile(new URL('../src-tauri/src/lib.rs', import.meta.url), 'utf8'),
    readFile(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'),
  ])
  assert.match(libRs, /011_trending_v2\.sql/)
  assert.match(tauriConf, /https:\/\/api\.github\.com/)
  assert.match(tauriConf, /https:\/\/raw\.githubusercontent\.com/)
})
