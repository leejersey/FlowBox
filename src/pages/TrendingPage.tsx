/**
 * TrendingPage — Dev Trending v2 极客热榜工作台
 * 支持今日飙升 / 每周高星 / 月度热榜、6 大板块分类独立排名、高星/热度/活跃排序、Master-Detail 项目速读
 */

import { useState, useEffect, useRef } from 'react'
import {
  Flame, RefreshCw, Sparkles, Search, ChevronDown, Loader2,
  Star, GitFork, GitPullRequest, TrendingUp, Rocket, ArrowUpDown,
  BookOpen, Check, Radar, UploadCloud, Plus, X, Scale, Copy, CheckSquare, Square
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'
import { useTrending } from '@/hooks/useTrending'
import { ResizablePanel } from '@/components/ui/ResizablePanel'
import { Modal } from '@/components/ui/Modal'
import { TrendingDetailPanel } from '@/components/trending/TrendingDetailPanel'
import { showToast } from '@/store/useToastStore'
import type { TrendingRepo } from '@/types/trending'
import {
  getCategoryMeta,
  matchRadarKeywords,
  parseJsonStringArray,
  parseRepoDeepDive,
  resolveRepoCategory,
  TRENDING_CATEGORIES,
  TRENDING_PERIODS,
  TRENDING_SORTS,
} from '@/lib/trendingCategory'

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

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-lg leading-none" title="#1">🥇</span>
  if (rank === 2) return <span className="text-lg leading-none" title="#2">🥈</span>
  if (rank === 3) return <span className="text-lg leading-none" title="#3">🥉</span>

  return (
    <span className={cn(
      'inline-flex items-center justify-center w-6 h-6 rounded-lg text-[11px] font-mono font-bold shrink-0',
      rank <= 10 ? 'bg-primary/15 text-primary' : 'bg-surface-container-highest text-on-surface-variant',
    )}>
      {rank}
    </span>
  )
}

// ─── 左侧紧凑榜单卡片 ───────────────────────────

function TrendingListCard({
  repo,
  rank,
  radarHits,
  compareMode,
  compareChecked,
  isSelected,
  isSaved,
  onSelect,
}: {
  repo: TrendingRepo
  rank: number
  radarHits: string[]
  compareMode: boolean
  compareChecked: boolean
  isSelected: boolean
  isSaved: boolean
  onSelect: (repo: TrendingRepo) => void
}) {
  const categoryId = resolveRepoCategory(repo)
  const categoryMeta = getCategoryMeta(categoryId)
  const aiTags = parseJsonStringArray(repo.ai_tags)
  const hasDeepDive = Boolean(parseRepoDeepDive(repo.ai_deep_dive))

  return (
    <div
      onClick={() => onSelect(repo)}
      className={cn(
        'group relative flex flex-col p-3.5 rounded-2xl transition-all duration-200 border cursor-pointer select-none',
        compareMode && compareChecked
          ? 'border-primary/60 bg-primary/12 shadow-md ring-1 ring-primary/30'
          : isSelected
          ? 'border-primary/50 bg-primary/10 shadow-md ring-1 ring-primary/30'
          : radarHits.length > 0
          ? 'bg-surface-container hover:bg-surface-container-highest border-orange-500/35 hover:border-orange-500/60 shadow-xs'
          : 'bg-surface-container hover:bg-surface-container-highest border-outline-variant/20 hover:border-outline-variant/40 shadow-xs',
      )}
    >
      {/* 顶行：排名 + 仓库名 + 板块标签 */}
      <div className="flex items-start gap-2.5 mb-1.5">
        <div className="pt-0.5 shrink-0 w-6 flex justify-center">
          {compareMode ? (
            compareChecked ? (
              <CheckSquare className="w-4 h-4 text-primary" />
            ) : (
              <Square className="w-4 h-4 text-on-surface-variant/45" />
            )
          ) : (
            <RankBadge rank={rank} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-xs font-display font-bold text-on-surface truncate flex-1" title={repo.repo_name}>
              {repo.repo_name}
            </h3>
            {radarHits.length > 0 && (
              <span
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-600 dark:text-orange-400 text-[10px] font-bold shrink-0"
                title={`命中雷达关键词：${radarHits.join(', ')}`}
              >
                🎯 {radarHits[0]}
              </span>
            )}
            {isSaved && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold shrink-0">
                <Check className="w-2.5 h-2.5" />
                已藏
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-bold', categoryMeta.badgeClass)}>
              {categoryMeta.emoji} {categoryMeta.shortLabel}
            </span>
            {repo.language && (
              <span className="flex items-center gap-1 text-[10px] text-on-surface-variant font-medium">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getLangColor(repo.language) }} />
                {repo.language}
              </span>
            )}
            {hasDeepDive && (
              <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold">
                已速读
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 一句话大白话定位 或 英文简介 */}
      <p className={cn(
        'text-xs leading-relaxed line-clamp-2 mt-1',
        repo.ai_summary_zh ? 'text-on-surface font-medium' : 'text-on-surface-variant',
      )}>
        {repo.ai_summary_zh || repo.description || '暂无简介，点击查看 README 与 AI 速读'}
      </p>

      {/* AI 场景标签 */}
      {aiTags.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap mt-2">
          {aiTags.slice(0, 3).map(tag => (
            <span key={tag} className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* 底部指标行 */}
      <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-outline-variant/10 text-[11px] text-on-surface-variant">
        <span className="flex items-center gap-1 font-semibold text-on-surface" title="周期新增 Stars">
          <Star className="w-3 h-3 text-amber-500" />
          +{formatNumber(repo.stars)}
        </span>
        <span className="flex items-center gap-1" title="Forks">
          <GitFork className="w-3 h-3" />
          {formatNumber(repo.forks)}
        </span>
        <span className="flex items-center gap-1" title="Pull Requests">
          <GitPullRequest className="w-3 h-3" />
          {formatNumber(repo.pull_requests)}
        </span>
        <span className="flex items-center gap-1 ml-auto text-primary font-bold" title="综合热度分">
          <TrendingUp className="w-3 h-3" />
          {formatNumber(repo.total_score)}
        </span>
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
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-highest text-xs font-medium text-on-surface-variant hover:text-on-surface transition-all border border-outline-variant/20 cursor-pointer"
      >
        {value === 'All' ? (
          '全部语言'
        ) : (
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getLangColor(value) }} />
            {value}
          </span>
        )}
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 bg-surface rounded-xl shadow-xl border border-outline-variant/30 py-1 z-50 min-w-[140px] max-h-[260px] overflow-y-auto animate-fade-in">
          {options.map(lang => (
            <button
              type="button"
              key={lang}
              onClick={() => { onChange(lang); setOpen(false) }}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors cursor-pointer text-left',
                lang === value
                  ? 'text-primary bg-primary/10 font-semibold'
                  : 'text-on-surface hover:bg-surface-container',
              )}
            >
              {lang !== 'All' && (
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getLangColor(lang) }} />
              )}
              {lang === 'All' ? '全部语言' : lang}
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
    period,
    setPeriod,
    sortBy,
    setSortBy,
    categoryFilter,
    setCategoryFilter,
    categoryCounts,
    topCategoryBreakdown,
    radarKeywords,
    addRadarKeyword,
    removeRadarKeyword,
    exportingDigest,
    exportDigest,
    compareMode,
    setCompareMode,
    compareIds,
    setCompareIds,
    toggleCompareId,
    comparing,
    compareResult,
    setCompareResult,
    runCompare,
    repos,
    totalCount,
    selectedRepo,
    setSelectedRepoId,
    loading,
    refreshing,
    summarizing,
    loadingOverviewId,
    generatingDeepDiveId,
    savedRepoIds,
    lastFetched,
    languageFilter,
    setLanguageFilter,
    searchKeyword,
    setSearchKeyword,
    availableLanguages,
    hasPendingSummaries,
    refresh,
    generateSummaries,
    loadRepoOverview,
    generateDeepDive,
    saveToIdea,
    saveToTodo,
    askButler,
  } = useTrending()

  const [searchInput, setSearchInput] = useState('')
  const [showRadarEditor, setShowRadarEditor] = useState(false)
  const [radarInput, setRadarInput] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setSearchKeyword(searchInput)
    }, 250)
    return () => clearTimeout(debounceRef.current)
  }, [searchInput, setSearchKeyword])

  // 键盘 ↑↓ 快速切榜单项目 & Esc 关闭详情
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement
      const isInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA'
      if (isInput) return

      if (e.key === 'ArrowDown' && repos.length > 0) {
        e.preventDefault()
        if (!selectedRepo) {
          setSelectedRepoId(repos[0].id)
        } else {
          const idx = repos.findIndex(r => r.id === selectedRepo.id)
          if (idx < repos.length - 1) setSelectedRepoId(repos[idx + 1].id)
        }
      } else if (e.key === 'ArrowUp' && repos.length > 0) {
        e.preventDefault()
        if (!selectedRepo) {
          setSelectedRepoId(repos[repos.length - 1].id)
        } else {
          const idx = repos.findIndex(r => r.id === selectedRepo.id)
          if (idx > 0) setSelectedRepoId(repos[idx - 1].id)
        }
      } else if (e.key === 'Escape' && selectedRepo) {
        setSelectedRepoId(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [repos, selectedRepo, setSelectedRepoId])

  const currentPeriodMeta = TRENDING_PERIODS.find(p => p.id === period) ?? TRENDING_PERIODS[1]
  const selectedRank = selectedRepo ? repos.findIndex(r => r.id === selectedRepo.id) + 1 : 0

  return (
    <div className="flex flex-col lg:flex-row h-full gap-6 w-full min-w-0 overflow-hidden animate-fade-in">
      {/* ── 左栏 Master：多维度排行榜 + 板块分类 ── */}
      <ResizablePanel
        id="trending"
        defaultWidth={430}
        minWidth={340}
        maxWidth={580}
        className={cn(selectedRepo ? 'hidden lg:flex' : 'flex')}
      >
        <div className="flex flex-col h-full min-h-0 gap-3 pr-1">
          {/* 顶部标题 + 刷新 & AI 摘要 */}
          <div className="flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Flame className="w-5 h-5 text-orange-500 shrink-0" />
              <h1 className="text-lg font-display font-bold text-on-surface truncate">GitHub 热点榜</h1>
              {!loading && totalCount > 0 && (
                <span className="text-[11px] font-bold text-on-surface-variant bg-surface-container-highest px-2 py-0.5 rounded-full shrink-0">
                  {repos.length}/{totalCount}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {hasPendingSummaries && (
                <button
                  type="button"
                  onClick={generateSummaries}
                  disabled={summarizing}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl primary-gradient-button text-xs font-bold cursor-pointer disabled:opacity-50"
                  title="批量生成 AI 中文定位与精准板块分类"
                >
                  {summarizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>{summarizing ? '分析中' : 'AI 速览'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setCompareMode(v => !v)
                  setCompareIds([])
                }}
                className={cn(
                  'p-2 rounded-xl transition-colors cursor-pointer',
                  compareMode
                    ? 'bg-primary/15 text-primary'
                    : 'bg-surface-container hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface',
                )}
                title="多项目 AI 横向对比（勾选 2~3 个项目）"
              >
                <Scale className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setShowRadarEditor(v => !v)}
                className={cn(
                  'p-2 rounded-xl transition-colors cursor-pointer',
                  showRadarEditor
                    ? 'bg-orange-500/15 text-orange-500'
                    : 'bg-surface-container hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface',
                )}
                title="配置技术订阅雷达关键词"
              >
                <Radar className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={exportDigest}
                disabled={exportingDigest}
                className="p-2 rounded-xl bg-surface-container hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer disabled:opacity-50"
                title="导出本期热点周报（Obsidian / 剪贴板）"
              >
                {exportingDigest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={refresh}
                disabled={refreshing}
                className="p-2 rounded-xl bg-surface-container hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer disabled:opacity-50"
                title="刷新当前榜单"
              >
                <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
              </button>
            </div>
          </div>

          {/* 技术雷达关键词配置抽屉 */}
          {showRadarEditor && (
            <div className="p-3 rounded-2xl bg-surface-container-low border border-orange-500/25 space-y-2.5 animate-fade-in shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-orange-600 dark:text-orange-400 flex items-center gap-1">
                  <Radar className="w-3.5 h-3.5" />
                  技术雷达订阅关键词（命中自动高亮）
                </span>
                <button
                  type="button"
                  onClick={() => setShowRadarEditor(false)}
                  className="p-0.5 rounded hover:bg-surface-container text-on-surface-variant cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {radarKeywords.map(kw => (
                  <span
                    key={kw}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-orange-500/12 text-orange-600 dark:text-orange-400 text-[11px] font-semibold"
                  >
                    {kw}
                    <button
                      type="button"
                      onClick={() => void removeRadarKeyword(kw)}
                      className="hover:text-red-500 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!radarInput.trim()) return
                  void addRadarKeyword(radarInput)
                  setRadarInput('')
                }}
                className="flex items-center gap-1.5"
              >
                <input
                  type="text"
                  value={radarInput}
                  onChange={e => setRadarInput(e.target.value)}
                  placeholder="添加关键词，如 MCP / DeepSeek / Tauri..."
                  className="flex-1 bg-surface px-2.5 py-1.5 rounded-xl text-xs text-on-surface outline-none border border-outline-variant/25 focus:border-primary/50"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1.5 rounded-xl bg-primary text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  添加
                </button>
              </form>
            </div>
          )}

          {/* 对比模式操作条 */}
          {compareMode && (
            <div className="px-3 py-2 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-between gap-2 text-xs animate-fade-in shrink-0">
              <span className="font-semibold text-primary">
                已勾选 {compareIds.length} / 3 个项目
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void runCompare()}
                  disabled={compareIds.length < 2 || comparing}
                  className="px-3 py-1 rounded-lg primary-gradient-button text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {comparing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Scale className="w-3 h-3" />}
                  {comparing ? '对比中...' : 'AI 横向对比'}
                </button>
                <button
                  type="button"
                  onClick={() => { setCompareMode(false); setCompareIds([]) }}
                  className="p-1 rounded-lg hover:bg-primary/15 text-primary cursor-pointer"
                  title="退出对比模式"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* 周期分段切换：今日飙升 / 每周高星 / 月度热榜 / 新秀黑马 */}
          <div className="flex items-center justify-between gap-2 shrink-0">
            <div className="flex-1 grid grid-cols-4 p-1 rounded-xl bg-surface-container border border-outline-variant/20">
              {TRENDING_PERIODS.map(item => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setPeriod(item.id)}
                  className={cn(
                    'py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer',
                    period === item.id
                      ? 'bg-surface text-primary shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 板块分类胶囊 Tab（板块内独立排名） */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 shrink-0">
            {TRENDING_CATEGORIES.map(cat => {
              const count = categoryCounts[cat.id]
              if (cat.id !== 'all' && count === 0) return null
              const active = categoryFilter === cat.id
              return (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setCategoryFilter(cat.id)}
                  className={cn(
                    'inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer border',
                    active
                      ? 'bg-primary text-white border-primary shadow-xs'
                      : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container border-outline-variant/20',
                  )}
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.shortLabel}</span>
                  <span className={cn('text-[10px] font-mono', active ? 'text-white/80' : 'text-on-surface-variant/60')}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* 搜索 + 排序 + 语言 */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-on-surface-variant/50" />
              <input
                type="text"
                placeholder="搜仓库 / 描述 / 标签..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                className="w-full bg-surface-container pl-8 pr-3 py-1.5 rounded-xl text-xs outline-none text-on-surface placeholder:text-on-surface-variant/50 focus:bg-surface-container-highest focus:ring-2 focus:ring-primary/20 transition-all border border-outline-variant/20"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                const idx = TRENDING_SORTS.findIndex(s => s.id === sortBy)
                const next = TRENDING_SORTS[(idx + 1) % TRENDING_SORTS.length]
                setSortBy(next.id)
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-highest text-xs font-medium text-on-surface-variant hover:text-on-surface transition-all border border-outline-variant/20 shrink-0 cursor-pointer"
              title="切换排序方式（高星飙升 / 综合热度 / 社区活跃）"
            >
              <ArrowUpDown className="w-3 h-3 text-primary" />
              <span>{TRENDING_SORTS.find(s => s.id === sortBy)?.label}</span>
            </button>

            <LanguageFilter
              value={languageFilter}
              options={availableLanguages}
              onChange={setLanguageFilter}
            />
          </div>

          {/* 列表区 */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pb-4 pr-0.5 custom-scrollbar">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-surface-container rounded-2xl p-4 animate-pulse space-y-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-surface-container-highest" />
                    <div className="h-4 bg-surface-container-highest rounded w-2/3" />
                  </div>
                  <div className="h-3 bg-surface-container-highest rounded w-full" />
                  <div className="h-3 bg-surface-container-highest rounded w-3/4" />
                </div>
              ))
            ) : repos.length > 0 ? (
              <>
                {repos.map((repo, i) => (
                  <TrendingListCard
                    key={repo.id}
                    repo={repo}
                    rank={i + 1}
                    radarHits={matchRadarKeywords(repo, radarKeywords)}
                    compareMode={compareMode}
                    compareChecked={compareIds.includes(repo.id)}
                    isSelected={!compareMode && selectedRepo?.id === repo.id}
                    isSaved={savedRepoIds.has(repo.repo_id)}
                    onSelect={item => {
                      if (compareMode) {
                        toggleCompareId(item.id)
                      } else {
                        setSelectedRepoId(item.id)
                      }
                    }}
                  />
                ))}
                <div className="text-center text-[11px] text-on-surface-variant/50 py-3 font-medium">
                  {lastFetched ? `更新于 ${lastFetched} · ` : ''}数据来源: OSS Insight & GitHub
                </div>
              </>
            ) : (
              <div className="text-center py-14 px-4 bg-surface-container-low rounded-2xl border border-dashed border-outline-variant/30">
                <Rocket className="w-10 h-10 mx-auto mb-3 text-primary/35" />
                <p className="text-sm font-bold text-on-surface mb-1">
                  {searchKeyword || languageFilter !== 'All' || categoryFilter !== 'all'
                    ? '没有匹配的开源项目'
                    : '暂无榜单数据'}
                </p>
                <p className="text-xs text-on-surface-variant mb-4">
                  {searchKeyword || languageFilter !== 'All' || categoryFilter !== 'all'
                    ? '试试切换板块或清空搜索词'
                    : '点击刷新获取最新 GitHub 热点榜'}
                </p>
                {!searchKeyword && languageFilter === 'All' && categoryFilter === 'all' && (
                  <button
                    type="button"
                    onClick={refresh}
                    disabled={refreshing}
                    className="primary-gradient-button px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
                    获取榜单
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </ResizablePanel>

      {/* ── 右栏 Detail：项目速读工作台 / 热点概览看板 ── */}
      <div className={cn(
        'flex-1 h-full min-w-0 flex-col overflow-hidden transition-all duration-300',
        selectedRepo ? 'flex' : 'hidden lg:flex',
      )}>
        {selectedRepo ? (
          <TrendingDetailPanel
            key={selectedRepo.id}
            repo={selectedRepo}
            rank={selectedRank > 0 ? selectedRank : 1}
            isSaved={savedRepoIds.has(selectedRepo.repo_id)}
            isLoadingOverview={loadingOverviewId === selectedRepo.id}
            isGeneratingDeepDive={generatingDeepDiveId === selectedRepo.id}
            onClose={() => setSelectedRepoId(null)}
            onSaveToIdea={saveToIdea}
            onSaveToTodo={saveToTodo}
            onAskButler={askButler}
            onLoadOverview={loadRepoOverview}
            onGenerateDeepDive={generateDeepDive}
          />
        ) : (
          <div className="h-full flex flex-col justify-between p-8 bg-surface-container/30 border border-outline-variant/20 rounded-3xl backdrop-blur-xl animate-fade-in overflow-y-auto custom-scrollbar">
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 text-primary mb-2">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-xs font-bold tracking-wider uppercase">{currentPeriodMeta.label} · 热点洞察</span>
                </div>
                <h2 className="text-2xl font-display font-bold text-on-surface">
                  选中左侧项目，10 秒看懂它做了什么
                </h2>
                <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed max-w-lg">
                  {currentPeriodMeta.description}。点击任意项目可直接在应用内阅读 README，或生成 AI 结构化速读卡（核心痛点、3 大亮点、上手门槛与同类对比）。
                </p>
              </div>

              {/* 板块分布概览 */}
              {topCategoryBreakdown.length > 0 && (
                <div className="p-5 rounded-2xl bg-surface-container-low/80 border border-outline-variant/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-on-surface">本期板块分布（点击直达板块排名）</span>
                    <span className="text-[11px] text-on-surface-variant font-mono">共 {totalCount} 个项目</span>
                  </div>
                  <div className="space-y-2.5">
                    {topCategoryBreakdown.map(cat => {
                      const pct = totalCount > 0 ? Math.round((cat.count / totalCount) * 100) : 0
                      return (
                        <button
                          type="button"
                          key={cat.id}
                          onClick={() => setCategoryFilter(cat.id)}
                          className="w-full text-left group cursor-pointer"
                        >
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-semibold text-on-surface group-hover:text-primary transition-colors">
                              {cat.emoji} {cat.label}
                            </span>
                            <span className="font-mono text-on-surface-variant">
                              {cat.count} 项 ({pct}%)
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-surface-container-highest overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary/70 group-hover:bg-primary transition-all duration-300"
                              style={{ width: `${Math.max(pct, 4)}%` }}
                            />
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 本期 Top 3 高星快览 */}
              {repos.length > 0 && (
                <div className="space-y-2.5">
                  <div className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                    当前榜单 Top 3
                  </div>
                  <div className="grid grid-cols-1 gap-2.5">
                    {repos.slice(0, 3).map((repo, idx) => (
                      <button
                        type="button"
                        key={repo.id}
                        onClick={() => setSelectedRepoId(repo.id)}
                        className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-surface-container-low/80 hover:bg-surface-container border border-outline-variant/20 hover:border-primary/30 transition-all text-left cursor-pointer group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <RankBadge rank={idx + 1} />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-on-surface group-hover:text-primary transition-colors truncate">
                              {repo.repo_name}
                            </div>
                            <div className="text-[11px] text-on-surface-variant truncate mt-0.5">
                              {repo.ai_summary_zh || repo.description || '点击查看项目速读'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 text-xs font-mono font-bold text-amber-500">
                          <Star className="w-3.5 h-3.5" />
                          +{formatNumber(repo.stars)}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-on-surface-variant/60 pt-6 border-t border-outline-variant/15 mt-6">
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                支持 <kbd className="px-1.5 py-0.5 rounded bg-surface-container border border-outline-variant/30 font-mono">↑</kbd> <kbd className="px-1.5 py-0.5 rounded bg-surface-container border border-outline-variant/30 font-mono">↓</kbd> 键盘切项目
              </span>
              <span>点击「AI 速览」可一次性为榜单生成中文定位与板块分类</span>
            </div>
          </div>
        )}
      </div>

      {/* 多项目 AI 横向对比报告弹窗 */}
      <Modal
        isOpen={Boolean(compareResult)}
        onClose={() => setCompareResult(null)}
        title="AI 多项目横向技术对比"
        description="基于项目核心定位、技术栈、README 与社区热度生成选型建议"
        maxWidth="lg"
        footer={
          <button
            type="button"
            onClick={async () => {
              if (!compareResult) return
              await navigator.clipboard.writeText(compareResult)
              showToast('对比报告已复制到剪贴板', 'success')
            }}
            className="px-4 py-2 rounded-xl primary-gradient-button text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            复制对比报告
          </button>
        }
      >
        {compareResult && (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-display select-text">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{compareResult}</ReactMarkdown>
          </div>
        )}
      </Modal>
    </div>
  )
}
