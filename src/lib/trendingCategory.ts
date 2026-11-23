import type { RepoDeepDive, TrendingCategoryId, TrendingPeriod, TrendingRepo, TrendingSortBy } from '../types/trending'

export interface TrendingCategoryMeta {
  id: TrendingCategoryId
  label: string
  shortLabel: string
  emoji: string
  badgeClass: string
}

export const TRENDING_CATEGORIES: TrendingCategoryMeta[] = [
  { id: 'all', label: '全部板块', shortLabel: '全部', emoji: '🔥', badgeClass: 'bg-surface-container-highest text-on-surface' },
  { id: 'radar', label: '雷达命中', shortLabel: '雷达命中', emoji: '🎯', badgeClass: 'bg-orange-500/15 text-orange-600 dark:text-orange-400' },
  { id: 'ai', label: 'AI & Agent', shortLabel: 'AI / Agent', emoji: '🤖', badgeClass: 'bg-violet-500/12 text-violet-600 dark:text-violet-400' },
  { id: 'devtools', label: '开发工具 & CLI', shortLabel: '开发工具', emoji: '⚡', badgeClass: 'bg-amber-500/12 text-amber-600 dark:text-amber-400' },
  { id: 'frontend', label: '前端 & UI', shortLabel: '前端 UI', emoji: '🎨', badgeClass: 'bg-sky-500/12 text-sky-600 dark:text-sky-400' },
  { id: 'backend', label: '后端 & 基础设施', shortLabel: '后端基建', emoji: '🧱', badgeClass: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400' },
  { id: 'desktop', label: '桌面 & 效率', shortLabel: '桌面效率', emoji: '📱', badgeClass: 'bg-indigo-500/12 text-indigo-600 dark:text-indigo-400' },
  { id: 'security', label: '安全 & 网络', shortLabel: '安全网络', emoji: '🔒', badgeClass: 'bg-rose-500/12 text-rose-600 dark:text-rose-400' },
  { id: 'other', label: '其他开源', shortLabel: '其他', emoji: '📦', badgeClass: 'bg-surface-container-highest text-on-surface-variant' },
]

export const TRENDING_PERIODS: { id: TrendingPeriod; label: string; description: string }[] = [
  { id: 'past_24_hours', label: '今日飙升', description: '过去 24 小时热度飙升的开源项目' },
  { id: 'past_week', label: '每周高星', description: '本周 GitHub 关注度与新增星标领先项目' },
  { id: 'past_month', label: '月度热榜', description: '近 30 天持续走高的标杆开源项目' },
  { id: 'rising_stars', label: '新秀黑马', description: '近 14 天刚开源即暴涨的新兴高星黑马项目' },
]

export const DEFAULT_RADAR_KEYWORDS = ['MCP', 'Agent', 'Tauri', 'Rust', 'LLM']

export const TRENDING_SORTS: { id: TrendingSortBy; label: string }[] = [
  { id: 'stars', label: '高星飙升' },
  { id: 'score', label: '综合热度' },
  { id: 'activity', label: '社区活跃' },
]

const VALID_CATEGORY_IDS = new Set<TrendingCategoryId>(
  TRENDING_CATEGORIES.map(c => c.id).filter(id => id !== 'all' && id !== 'radar'),
)

const CATEGORY_RULES: { id: Exclude<TrendingCategoryId, 'all' | 'radar' | 'other'>; patterns: RegExp[] }[] = [
  {
    id: 'ai',
    patterns: [
      /\b(ai|llm|llms|gpt|claude|gemini|openai|anthropic|deepseek|qwen|llama|mistral|ollama|vllm)\b/i,
      /\b(agent|agents|agentic|mcp|rag|embedding|diffusion|transformer|whisper|tts|asr|ocr|vision|multimodal|copilot|prompt|langchain|langgraph|autogen|crewai|huggingface|pytorch|mlx|gguf)\b/i,
      /大模型|智能体|人工智能|机器学习|深度学习|向量/,
    ],
  },
  {
    id: 'security',
    patterns: [
      /\b(security|pentest|ctf|exploit|vuln|scanner|firewall|vpn|proxy|clash|v2ray|sing-box|wireguard|auth|oauth|jwt|crypto|encryption|waf|siem|malware|reverse[- ]?engineering)\b/i,
      /安全|代理|加密|渗透|防火墙/,
    ],
  },
  {
    id: 'frontend',
    patterns: [
      /\b(react|vue|svelte|nextjs|next\.js|nuxt|astro|tailwind|shadcn|radix|css|html|ui|ux|component|design[- ]?system|canvas|webgl|three\.?js|chart|echarts|animation|framer|frontend|browser|extension)\b/i,
      /前端|组件库|样式|界面/,
    ],
  },
  {
    id: 'desktop',
    patterns: [
      /\b(tauri|electron|macos|windows|desktop|ios|android|flutter|swiftui|note|notes|obsidian|notion|markdown|editor|calendar|todo|pomodoro|clipboard|launcher|raycast|media|player|video|audio|download|rss|bookmark)\b/i,
      /桌面|笔记|效率|客户端|播放器/,
    ],
  },
  {
    id: 'backend',
    patterns: [
      /\b(database|sql|sqlite|postgres|postgresql|mysql|redis|clickhouse|duckdb|kafka|grpc|graphql|api|gateway|kubernetes|k8s|docker|container|cloud|serverless|microservice|distributed|storage|queue|cache|orm|runtime|server|backend)\b/i,
      /数据库|后端|分布式|容器|服务器/,
    ],
  },
  {
    id: 'devtools',
    patterns: [
      /\b(cli|terminal|shell|zsh|tmux|vim|neovim|vscode|ide|sdk|compiler|linter|formatter|bundler|vite|webpack|esbuild|git|github|ci|cd|devops|terraform|ansible|debug|test|testing|benchmark|monitor|observability|profiler|package[- ]?manager|workflow|automation)\b/i,
      /命令行|终端|编译器|构建|调试|开发工具/,
    ],
  },
]

export function normalizeCategoryId(raw?: string | null): Exclude<TrendingCategoryId, 'all' | 'radar'> {
  if (!raw) return 'other'
  const lower = raw.trim().toLowerCase() as TrendingCategoryId
  if (VALID_CATEGORY_IDS.has(lower)) {
    return lower as Exclude<TrendingCategoryId, 'all' | 'radar'>
  }
  return 'other'
}

/** 规则初筛：根据仓库名、简介、语言、topics 推断所属板块 */
export function inferTrendingCategory(input: {
  repo_name: string
  description?: string | null
  language?: string | null
  topics?: string[]
}): Exclude<TrendingCategoryId, 'all' | 'radar'> {
  const haystack = [
    input.repo_name,
    input.description ?? '',
    (input.topics ?? []).join(' '),
  ].join(' ')

  for (const rule of CATEGORY_RULES) {
    if (rule.patterns.some(pattern => pattern.test(haystack))) {
      return rule.id
    }
  }

  // 语言兜底归类
  const lang = (input.language ?? '').toLowerCase()
  if (lang === 'css' || lang === 'scss' || lang === 'vue' || lang === 'svelte' || lang === 'html') {
    return 'frontend'
  }
  if (lang === 'swift' || lang === 'kotlin' || lang === 'dart') {
    return 'desktop'
  }
  if (lang === 'shell' || lang === 'dockerfile' || lang === 'makefile') {
    return 'devtools'
  }
  if (lang === 'jupyter notebook') {
    return 'ai'
  }

  return 'other'
}

export function resolveRepoCategory(repo: Pick<TrendingRepo, 'repo_name' | 'description' | 'language' | 'category' | 'topics'>): Exclude<TrendingCategoryId, 'all' | 'radar'> {
  if (repo.category && VALID_CATEGORY_IDS.has(repo.category as TrendingCategoryId)) {
    return repo.category as Exclude<TrendingCategoryId, 'all' | 'radar'>
  }
  return inferTrendingCategory({
    repo_name: repo.repo_name,
    description: repo.description,
    language: repo.language,
    topics: parseJsonStringArray(repo.topics),
  })
}

export function getCategoryMeta(id: TrendingCategoryId): TrendingCategoryMeta {
  return TRENDING_CATEGORIES.find(c => c.id === id) ?? TRENDING_CATEGORIES[TRENDING_CATEGORIES.length - 1]
}

export function parseJsonStringArray(raw?: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string' && v.trim().length > 0) : []
  } catch {
    return []
  }
}

export function parseRepoDeepDive(raw?: string | null): RepoDeepDive | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<RepoDeepDive>
    if (!parsed || typeof parsed !== 'object') return null
    if (!parsed.one_liner && !parsed.problem) return null
    return {
      one_liner: String(parsed.one_liner ?? '').trim(),
      problem: String(parsed.problem ?? '').trim(),
      highlights: Array.isArray(parsed.highlights)
        ? parsed.highlights.map(item => String(item).trim()).filter(Boolean)
        : [],
      quickstart: String(parsed.quickstart ?? '').trim(),
      comparison: String(parsed.comparison ?? '').trim(),
    }
  } catch {
    return null
  }
}

export function sortTrendingRepos(repos: TrendingRepo[], sortBy: TrendingSortBy): TrendingRepo[] {
  const list = [...repos]
  if (sortBy === 'stars') {
    return list.sort((a, b) => b.stars - a.stars || b.total_score - a.total_score)
  }
  if (sortBy === 'activity') {
    return list.sort((a, b) => (b.pull_requests * 3 + b.forks) - (a.pull_requests * 3 + a.forks) || b.stars - a.stars)
  }
  return list.sort((a, b) => b.total_score - a.total_score || b.stars - a.stars)
}

/** 匹配自定义雷达关键词，返回命中的所有关键词 */
export function matchRadarKeywords(
  repo: Pick<TrendingRepo, 'repo_name' | 'description' | 'language' | 'ai_summary_zh' | 'ai_tags' | 'topics'>,
  keywords: string[],
): string[] {
  const normalized = keywords.map(k => k.trim()).filter(Boolean)
  if (normalized.length === 0) return []

  const haystack = [
    repo.repo_name,
    repo.description,
    repo.language,
    repo.ai_summary_zh ?? '',
    repo.ai_tags ?? '',
    repo.topics ?? '',
  ].join(' ').toLowerCase()

  return normalized.filter(kw => haystack.includes(kw.toLowerCase()))
}

/** 生成结构化 GitHub 热点周报 Markdown（供 Obsidian 导出或剪贴板复制） */
export function buildTrendingDigestMarkdown(params: {
  periodLabel: string
  date: string
  repos: TrendingRepo[]
  radarKeywords: string[]
}): string {
  const { periodLabel, date, repos, radarKeywords } = params
  const topRepos = repos.slice(0, 12)
  const radarHits = repos.filter(r => matchRadarKeywords(r, radarKeywords).length > 0)

  const lines: string[] = [
    `# 🔥 GitHub ${periodLabel} 开源情报 (${date})`,
    '',
    `> 共收录 **${repos.length}** 个热门项目，雷达命中 **${radarHits.length}** 个。`,
    '',
  ]

  if (radarHits.length > 0) {
    lines.push(`## 🎯 技术雷达命中（关键词：${radarKeywords.join(' / ')}）`, '')
    for (const repo of radarHits.slice(0, 8)) {
      const hits = matchRadarKeywords(repo, radarKeywords)
      const summary = repo.ai_summary_zh || repo.description || '暂无简介'
      lines.push(`- **[${repo.repo_name}](https://github.com/${repo.repo_name})**（⭐ +${repo.stars.toLocaleString()} · 命中：${hits.join(', ')}）— ${summary}`)
    }
    lines.push('')
  }

  lines.push(`## 🏆 ${periodLabel} Top ${topRepos.length}`, '')
  topRepos.forEach((repo, idx) => {
    const catMeta = getCategoryMeta(resolveRepoCategory(repo))
    const deepDive = parseRepoDeepDive(repo.ai_deep_dive)
    lines.push(`### ${idx + 1}. [${repo.repo_name}](https://github.com/${repo.repo_name})`)
    lines.push(`- **板块**：${catMeta.emoji} ${catMeta.label} | **语言**：${repo.language || 'Unknown'} | **Stars**：+${repo.stars.toLocaleString()} | **Forks**：${repo.forks.toLocaleString()}`)
    lines.push(`- **定位**：${deepDive?.one_liner || repo.ai_summary_zh || repo.description || '暂无简介'}`)
    if (deepDive?.highlights && deepDive.highlights.length > 0) {
      lines.push(`- **核心亮点**：${deepDive.highlights.join('；')}`)
    }
    lines.push('')
  })

  return lines.join('\n').trim() + '\n'
}
