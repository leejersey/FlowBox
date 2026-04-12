/**
 * TrendingPage — Dev Trending 页面
 * 展示 GitHub 热门仓库卡片列表，支持筛选、搜索、AI 摘要、收藏
 */

import { useState, useEffect, useRef } from 'react'
import {
  Flame, RefreshCw, Sparkles, ExternalLink, Lightbulb,
  Search, ChevronDown, Loader2, Star, GitFork,
  GitPullRequest, TrendingUp, Rocket
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTrending } from '@/hooks/useTrending'
import type { TrendingRepo } from '@/types/trending'

// ─── GitHub 语言颜色映射 ────────────────────────

const LANG_COLORS: Record<string, string> = {
  Python: '#3572A5',
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Rust: '#dea584',
  Go: '#00ADD8',
  Java: '#b07219',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Dart: '#00B4AB',
  Shell: '#89e051',
  Scala: '#c22d40',
  Vue: '#41b883',
  Lua: '#000080',
  Zig: '#ec915c',
  Elixir: '#6e4a7e',
  Jupyter: '#DA5B0B',
}

function getLangColor(lang: string): string {
  return LANG_COLORS[lang] ?? '#8b8b8b'
}

// ─── 排名徽章组件 ────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-2xl" title="#1">🥇</span>
  if (rank === 2) return <span className="text-2xl" title="#2">🥈</span>
  if (rank === 3) return <span className="text-2xl" title="#3">🥉</span>

  if (rank <= 10) {
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/15 text-primary text-sm font-bold">
        {rank}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-surface-container-highest text-on-surface-variant text-sm font-medium">
      {rank}
    </span>
  )
}

// ─── 统计数字格式化 ──────────────────────────────

function formatNumber(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

// ─── 仓库卡片组件 ────────────────────────────────

function TrendingCard({
  repo,
  rank,
  onSaveToIdea,
}: {
  repo: TrendingRepo
  rank: number
  onSaveToIdea: (repo: TrendingRepo) => void
}) {
  const [saving, setSaving] = useState(false)

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setSaving(true)
    await onSaveToIdea(repo)
    setSaving(false)
  }

  const handleOpenGithub = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.open(`https://github.com/${repo.repo_name}`, '_blank')
  }

  // 解析贡献者
  let contributors: string[] = []
  try {
    contributors = JSON.parse(repo.contributors || '[]')
  } catch { /* ignore */ }

  return (
    <div className="group bg-surface-container hover:bg-surface-container-highest transition-all duration-300 rounded-3xl p-6 shadow-sm border border-transparent hover:border-white/10 hover:shadow-md">
      {/* Header: 排名 + 仓库名 + 语言 */}
      <div className="flex items-start gap-4 mb-4">
        <div className="pt-0.5 shrink-0">
          <RankBadge rank={rank} />
        </div>
        <div className="flex-1 min-w-0">
          <h3
            className="text-lg font-display font-bold text-on-surface truncate cursor-pointer hover:text-primary transition-colors"
            onClick={handleOpenGithub}
            title={repo.repo_name}
          >
            {repo.repo_name}
          </h3>
          {repo.language && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: getLangColor(repo.language) }}
              />
              <span className="text-xs font-medium text-on-surface-variant">{repo.language}</span>
            </div>
          )}
        </div>
      </div>

      {/* 描述 */}
      {repo.description && (
        <p className="text-sm text-on-surface-variant leading-relaxed mb-4 line-clamp-2">
          {repo.description}
        </p>
      )}

      {/* AI 摘要 */}
      {repo.ai_summary_zh ? (
        <div className="bg-gradient-to-r from-primary/5 to-purple-500/5 rounded-2xl p-4 mb-4 border border-primary/10">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-bold text-primary">AI 摘要</span>
          </div>
          <p className="text-sm text-on-surface leading-relaxed">{repo.ai_summary_zh}</p>
        </div>
      ) : (
        <div className="bg-surface-container-highest/50 rounded-2xl p-3 mb-4 border border-dashed border-on-surface-variant/10">
          <p className="text-xs text-on-surface-variant/50 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" />
            点击上方「生成 AI 摘要」按钮
          </p>
        </div>
      )}

      {/* 统计行 */}
      <div className="flex items-center gap-4 text-xs text-on-surface-variant mb-4">
        <span className="flex items-center gap-1" title="Stars">
          <Star className="w-3.5 h-3.5 text-amber-500" />
          <span className="font-medium">{formatNumber(repo.stars)}</span>
        </span>
        <span className="flex items-center gap-1" title="Forks">
          <GitFork className="w-3.5 h-3.5" />
          <span className="font-medium">{formatNumber(repo.forks)}</span>
        </span>
        <span className="flex items-center gap-1" title="Pull Requests">
          <GitPullRequest className="w-3.5 h-3.5" />
          <span className="font-medium">{formatNumber(repo.pull_requests)}</span>
        </span>
        <span className="flex items-center gap-1 ml-auto" title="Trending Score">
          <TrendingUp className="w-3.5 h-3.5 text-primary" />
          <span className="font-bold text-primary">{formatNumber(repo.total_score)}</span>
        </span>
      </div>

      {/* 贡献者 */}
      {contributors.length > 0 && (
        <div className="flex items-center gap-1.5 mb-4 text-xs text-on-surface-variant">
          <span className="opacity-60">👥</span>
          <span className="truncate">{contributors.slice(0, 5).join(', ')}</span>
          {contributors.length > 5 && (
            <span className="opacity-50">+{contributors.length - 5}</span>
          )}
        </div>
      )}

      {/* 操作栏 */}
      <div className="flex items-center gap-2 pt-3 border-t border-surface-container-highest">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lightbulb className="w-3.5 h-3.5" />}
          收藏到灵感
        </button>
        <button
          onClick={handleOpenGithub}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-on-surface-variant hover:text-on-surface hover:bg-on-surface/5 transition-all ml-auto"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          GitHub
        </button>
      </div>
    </div>
  )
}

// ─── 骨架屏 ──────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-surface-container rounded-3xl p-6 animate-pulse">
      <div className="flex items-start gap-4 mb-4">
        <div className="w-8 h-8 rounded-full bg-surface-container-highest" />
        <div className="flex-1">
          <div className="h-5 bg-surface-container-highest rounded-lg w-3/4 mb-2" />
          <div className="h-3 bg-surface-container-highest rounded w-20" />
        </div>
      </div>
      <div className="h-4 bg-surface-container-highest rounded-lg w-full mb-2" />
      <div className="h-4 bg-surface-container-highest rounded-lg w-2/3 mb-4" />
      <div className="h-16 bg-surface-container-highest/50 rounded-2xl mb-4" />
      <div className="flex gap-4">
        <div className="h-3 bg-surface-container-highest rounded w-12" />
        <div className="h-3 bg-surface-container-highest rounded w-12" />
        <div className="h-3 bg-surface-container-highest rounded w-12" />
      </div>
    </div>
  )
}

// ─── 语言筛选下拉 ────────────────────────────────

function LanguageFilter({
  value,
  options,
  onChange,
}: {
  value: string
  options: string[]
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-container hover:bg-surface-container-highest text-sm font-medium text-on-surface-variant transition-all border border-transparent hover:border-white/10"
      >
        {value === 'All' ? (
          '所有语言'
        ) : (
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getLangColor(value) }} />
            {value}
          </span>
        )}
        <ChevronDown className={cn("w-4 h-4 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 bg-surface rounded-xl shadow-lg border border-white/20 py-1 z-50 min-w-[160px] max-h-[300px] overflow-y-auto">
          {options.map(lang => (
            <button
              key={lang}
              onClick={() => { onChange(lang); setOpen(false) }}
              className={cn(
                "w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors",
                lang === value
                  ? "text-primary bg-primary/10 font-medium"
                  : "text-on-surface hover:bg-surface-container"
              )}
            >
              {lang !== 'All' && (
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: getLangColor(lang) }} />
              )}
              {lang === 'All' ? '所有语言' : lang}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── 主页面 ──────────────────────────────────────

export function TrendingPage() {
  const {
    repos,
    totalCount,
    loading,
    refreshing,
    summarizing,
    lastFetched,
    languageFilter,
    setLanguageFilter,
    searchKeyword,
    setSearchKeyword,
    availableLanguages,
    hasPendingSummaries,
    refresh,
    generateSummaries,
    saveToIdea,
  } = useTrending()

  // 搜索防抖
  const [searchInput, setSearchInput] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setSearchKeyword(searchInput)
    }, 250)
    return () => clearTimeout(debounceRef.current)
  }, [searchInput, setSearchKeyword])

  // ─── 加载状态 ──────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col h-full animate-fade-in w-full max-w-5xl mx-auto overflow-y-auto pb-10">
        {/* Header Skeleton */}
        <div className="mb-8">
          <div className="h-8 bg-surface-container-highest rounded-lg w-48 mb-2 animate-pulse" />
          <div className="h-4 bg-surface-container-highest rounded w-64 animate-pulse" />
        </div>
        {/* Cards Skeleton */}
        <div className="grid gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    )
  }

  // ─── 主内容 ────────────────────────────────────

  return (
    <div className="flex flex-col h-full animate-fade-in w-full max-w-5xl mx-auto overflow-y-auto overflow-x-hidden pb-10">
      {/* 页面头部 */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Flame className="w-7 h-7 text-orange-500" />
          <h1 className="text-2xl font-display font-bold text-on-surface">Dev Trending</h1>
          {!loading && totalCount > 0 && (
            <span className="text-xs font-bold text-on-surface bg-surface-container-highest px-3 py-1 rounded-full">
              {totalCount} 项
            </span>
          )}
        </div>
        <p className="text-sm text-on-surface-variant">
          本周 GitHub 热门开源项目
          {lastFetched && (
            <span className="ml-2 opacity-60">· 数据日期: {lastFetched}</span>
          )}
        </p>
      </div>

      {/* 工具栏 */}
      <div className="flex items-center gap-3 mb-8 flex-wrap">
        {/* 搜索 */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
          <input
            type="text"
            placeholder="搜索仓库名或描述..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="w-full bg-surface-container pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none text-on-surface placeholder:text-on-surface-variant/50 focus:bg-surface-container-highest focus:ring-2 focus:ring-primary/20 transition-all border border-transparent hover:border-white/10"
          />
        </div>

        {/* 语言筛选 */}
        <LanguageFilter
          value={languageFilter}
          options={availableLanguages}
          onChange={setLanguageFilter}
        />

        {/* 刷新按钮 */}
        <button
          onClick={refresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-highest text-sm font-medium text-on-surface-variant hover:text-on-surface transition-all disabled:opacity-50 border border-transparent hover:border-white/10"
        >
          <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
          {refreshing ? '刷新中...' : '刷新数据'}
        </button>

        {/* AI 摘要按钮 */}
        {hasPendingSummaries && (
          <button
            onClick={generateSummaries}
            disabled={summarizing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl primary-gradient-button text-sm font-bold disabled:opacity-50"
          >
            {summarizing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {summarizing ? '生成中...' : '生成 AI 摘要'}
          </button>
        )}
      </div>

      {/* 卡片列表 */}
      {repos.length > 0 ? (
        <>
          <div className="grid gap-5">
            {repos.map((repo, i) => (
              <TrendingCard
                key={repo.id}
                repo={repo}
                rank={i + 1}
                onSaveToIdea={saveToIdea}
              />
            ))}
          </div>

          {/* 底部状态栏 */}
          <div className="text-center text-xs text-on-surface-variant/50 mt-8 font-medium">
            显示 {repos.length} / {totalCount} 条 · 数据来源: OSS Insight
          </div>
        </>
      ) : (
        /* 空状态 */
        <div className="text-center py-20 bg-surface-container-low rounded-3xl border border-dashed border-on-surface-variant/20">
          <Rocket className="w-14 h-14 mx-auto mb-4 text-primary/30" />
          <p className="text-lg mb-2 font-display font-bold text-on-surface">
            {searchKeyword || languageFilter !== 'All'
              ? '没有匹配的仓库'
              : '暂无热门仓库数据'}
          </p>
          <p className="text-sm text-on-surface-variant mb-6">
            {searchKeyword || languageFilter !== 'All'
              ? '尝试调整筛选条件'
              : '点击下方按钮获取本周 GitHub 热门项目'}
          </p>
          {!searchKeyword && languageFilter === 'All' && (
            <button
              onClick={refresh}
              disabled={refreshing}
              className="primary-gradient-button px-6 py-2.5 rounded-full font-bold text-sm inline-flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
              {refreshing ? '获取中...' : '获取热门仓库'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
