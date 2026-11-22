import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  X, Star, GitFork, GitPullRequest, TrendingUp, ExternalLink,
  Lightbulb, Sparkles, BookOpen, RefreshCw, Loader2, Check,
  Copy, Globe, Target, Wrench, Scale, Layers
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TrendingRepo } from '@/types/trending'
import {
  getCategoryMeta,
  parseJsonStringArray,
  parseRepoDeepDive,
  resolveRepoCategory,
} from '@/lib/trendingCategory'
import { showToast } from '@/store/useToastStore'

interface TrendingDetailPanelProps {
  repo: TrendingRepo
  rank: number
  isSaved: boolean
  isLoadingOverview: boolean
  isGeneratingDeepDive: boolean
  onClose: () => void
  onSaveToIdea: (repo: TrendingRepo) => Promise<void>
  onLoadOverview: (repo: TrendingRepo, forceRefresh?: boolean) => Promise<TrendingRepo>
  onGenerateDeepDive: (repo: TrendingRepo, forceRefresh?: boolean) => Promise<TrendingRepo>
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

export function TrendingDetailPanel({
  repo,
  rank,
  isSaved,
  isLoadingOverview,
  isGeneratingDeepDive,
  onClose,
  onSaveToIdea,
  onLoadOverview,
  onGenerateDeepDive,
}: TrendingDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'readme'>('summary')
  const [saving, setSaving] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)

  const categoryId = resolveRepoCategory(repo)
  const categoryMeta = getCategoryMeta(categoryId)
  const deepDive = parseRepoDeepDive(repo.ai_deep_dive)
  const aiTags = parseJsonStringArray(repo.ai_tags)
  const topics = parseJsonStringArray(repo.topics)
  const contributors = parseJsonStringArray(repo.contributors)
  const repoUrl = `https://github.com/${repo.repo_name}`

  // 首次打开且无 README 缓存时自动拉取元信息与 README
  useEffect(() => {
    if (!repo.readme_excerpt) {
      void onLoadOverview(repo, false)
    }
    // 仅在切换仓库 ID 时触发一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo.id])

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSaveToIdea(repo)
    } finally {
      setSaving(false)
    }
  }

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(repoUrl)
      setCopiedUrl(true)
      showToast('仓库地址已复制', 'success')
      window.setTimeout(() => setCopiedUrl(false), 1800)
    } catch {
      showToast('复制失败', 'error')
    }
  }

  return (
    <div className="h-full flex flex-col bg-surface-container/60 border border-outline-variant/30 rounded-3xl overflow-hidden backdrop-blur-xl animate-fade-in shadow-xl">
      {/* 顶栏 */}
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-outline-variant/20 bg-surface/50 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="px-2 py-0.5 rounded-lg bg-primary/15 text-primary text-xs font-mono font-bold shrink-0">
            #{rank}
          </span>
          <span className={cn('px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0', categoryMeta.badgeClass)}>
            {categoryMeta.emoji} {categoryMeta.shortLabel}
          </span>
          <h2 className="text-sm font-display font-bold text-on-surface truncate" title={repo.repo_name}>
            {repo.repo_name}
          </h2>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-50',
              isSaved
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : 'bg-surface-container-highest text-on-surface hover:text-primary hover:bg-primary/10',
            )}
            title="收藏到灵感便签"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isSaved ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Lightbulb className="w-3.5 h-3.5" />
            )}
            <span>{isSaved ? '已收藏' : '收藏灵感'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyUrl}
            className="p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
            title="复制 GitHub 链接"
          >
            {copiedUrl ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>

          {repo.homepage && (
            <button
              type="button"
              onClick={() => window.open(repo.homepage!, '_blank')}
              className="p-2 rounded-xl text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
              title={`访问项目官网: ${repo.homepage}`}
            >
              <Globe className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => window.open(repoUrl, '_blank')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
            title="在浏览器中打开 GitHub"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">GitHub</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
            title="关闭详情 (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 指标 + Tab 切换 */}
      <div className="px-6 pt-4 pb-3 border-b border-outline-variant/15 bg-surface-container-low/40 shrink-0 space-y-3">
        <div className="flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
          <span className="flex items-center gap-1 font-semibold text-on-surface">
            <Star className="w-3.5 h-3.5 text-amber-500" />
            +{formatNumber(repo.stars)} Stars
          </span>
          <span className="flex items-center gap-1">
            <GitFork className="w-3.5 h-3.5" />
            {formatNumber(repo.forks)} Forks
          </span>
          <span className="flex items-center gap-1">
            <GitPullRequest className="w-3.5 h-3.5" />
            {formatNumber(repo.pull_requests)} PRs
          </span>
          <span className="flex items-center gap-1 text-primary font-semibold">
            <TrendingUp className="w-3.5 h-3.5" />
            热度 {formatNumber(repo.total_score)}
          </span>
          {repo.language && (
            <span className="px-2 py-0.5 rounded-md bg-surface-container-highest text-on-surface font-medium">
              {repo.language}
            </span>
          )}
        </div>

        {(aiTags.length > 0 || topics.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {aiTags.map(tag => (
              <span key={`ai-${tag}`} className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] font-semibold">
                #{tag}
              </span>
            ))}
            {topics.slice(0, 6).map(topic => (
              <span key={`topic-${topic}`} className="px-2 py-0.5 rounded-md bg-surface-container text-on-surface-variant text-[11px]">
                {topic}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="inline-flex p-1 rounded-xl bg-surface-container border border-outline-variant/20">
            <button
              type="button"
              onClick={() => setActiveTab('summary')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                activeTab === 'summary'
                  ? 'bg-surface text-primary shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface',
              )}
            >
              <Sparkles className="w-3.5 h-3.5" />
              AI 项目速读
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('readme')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                activeTab === 'readme'
                  ? 'bg-surface text-primary shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface',
              )}
            >
              <BookOpen className="w-3.5 h-3.5" />
              README 原文
            </button>
          </div>

          {activeTab === 'summary' ? (
            <button
              type="button"
              onClick={() => void onGenerateDeepDive(repo, Boolean(deepDive))}
              disabled={isGeneratingDeepDive}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold primary-gradient-button cursor-pointer disabled:opacity-50"
            >
              {isGeneratingDeepDive ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              {isGeneratingDeepDive ? '深度解析中...' : deepDive ? '重新生成速读' : '生成深度速读卡'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void onLoadOverview(repo, true)}
              disabled={isLoadingOverview}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface-container hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isLoadingOverview && 'animate-spin')} />
              刷新 README
            </button>
          )}
        </div>
      </div>

      {/* 主体内容区 */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
        {activeTab === 'summary' ? (
          deepDive ? (
            <div className="space-y-4 animate-fade-in">
              {/* 一句话说透 */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-primary/12 via-primary/5 to-transparent border border-primary/20">
                <div className="flex items-center gap-1.5 text-xs font-bold text-primary mb-2">
                  <Target className="w-4 h-4" />
                  <span>一句话说透</span>
                </div>
                <p className="text-sm font-semibold text-on-surface leading-relaxed select-text">
                  {deepDive.one_liner}
                </p>
              </div>

              {/* 核心解决什么痛点 */}
              {deepDive.problem && (
                <div className="p-4 rounded-2xl bg-surface-container-low/80 border border-outline-variant/20">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-on-surface-variant mb-2">
                    <Layers className="w-3.5 h-3.5 text-primary" />
                    <span>核心解决什么问题</span>
                  </div>
                  <p className="text-sm text-on-surface leading-relaxed select-text">
                    {deepDive.problem}
                  </p>
                </div>
              )}

              {/* 核心亮点 */}
              {deepDive.highlights.length > 0 && (
                <div className="p-4 rounded-2xl bg-surface-container-low/80 border border-outline-variant/20">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-on-surface-variant mb-3">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>核心亮点与能力</span>
                  </div>
                  <div className="space-y-2.5">
                    {deepDive.highlights.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-sm text-on-surface leading-relaxed select-text">
                        <span className="w-5 h-5 rounded-lg bg-primary/12 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 上手方式 & 同类对比 */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {deepDive.quickstart && (
                  <div className="p-4 rounded-2xl bg-surface-container-low/80 border border-outline-variant/20">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-on-surface-variant mb-2">
                      <Wrench className="w-3.5 h-3.5 text-emerald-500" />
                      <span>技术栈与上手门槛</span>
                    </div>
                    <p className="text-xs text-on-surface leading-relaxed select-text">
                      {deepDive.quickstart}
                    </p>
                  </div>
                )}

                {deepDive.comparison && (
                  <div className="p-4 rounded-2xl bg-surface-container-low/80 border border-outline-variant/20">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-on-surface-variant mb-2">
                      <Scale className="w-3.5 h-3.5 text-violet-500" />
                      <span>同类对比与差异</span>
                    </div>
                    <p className="text-xs text-on-surface leading-relaxed select-text">
                      {deepDive.comparison}
                    </p>
                  </div>
                )}
              </div>

              {contributors.length > 0 && (
                <div className="text-xs text-on-surface-variant/75 pt-2">
                  活跃贡献者：{contributors.slice(0, 8).join(', ')}
                  {contributors.length > 8 ? ` +${contributors.length - 8}` : ''}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* 已有的一句话摘要或英文简介 */}
              <div className="p-5 rounded-2xl bg-surface-container-low/80 border border-outline-variant/20 space-y-2.5">
                <div className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  项目简介
                </div>
                {repo.ai_summary_zh && (
                  <p className="text-sm font-semibold text-on-surface leading-relaxed select-text">
                    {repo.ai_summary_zh}
                  </p>
                )}
                {repo.description && (
                  <p className="text-xs text-on-surface-variant leading-relaxed select-text">
                    {repo.description}
                  </p>
                )}
              </div>

              {/* 引导生成深度速读卡 */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/8 via-surface-container-low to-surface-container-low border border-dashed border-primary/30 flex flex-col items-center text-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-primary/15 text-primary flex items-center justify-center">
                  {isGeneratingDeepDive ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Sparkles className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-on-surface">
                    {isGeneratingDeepDive ? '正在结合 README 生成深度速读...' : '10 秒看懂这个项目做了什么'}
                  </h3>
                  <p className="text-xs text-on-surface-variant mt-1 max-w-sm leading-relaxed">
                    自动读取仓库 README，为你提炼核心痛点、3 大亮点、上手门槛与同类工具对比，结果会缓存在本地。
                  </p>
                </div>
                <div className="flex items-center gap-2.5 mt-1">
                  <button
                    type="button"
                    onClick={() => void onGenerateDeepDive(repo, false)}
                    disabled={isGeneratingDeepDive}
                    className="px-4 py-2 rounded-xl text-xs font-bold primary-gradient-button flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {isGeneratingDeepDive ? '解析中...' : '生成 AI 深度速读卡'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('readme')}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-surface-container hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                  >
                    直接看 README
                  </button>
                </div>
              </div>
            </div>
          )
        ) : (
          /* README 原文 Tab */
          isLoadingOverview && !repo.readme_excerpt ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-6 bg-surface-container-highest rounded-lg w-1/2" />
              <div className="h-4 bg-surface-container-highest rounded w-full" />
              <div className="h-4 bg-surface-container-highest rounded w-5/6" />
              <div className="h-32 bg-surface-container-highest rounded-2xl w-full mt-4" />
            </div>
          ) : repo.readme_excerpt ? (
            <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-display prose-a:text-primary prose-pre:bg-surface-container-highest/70 prose-pre:rounded-xl select-text">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {repo.readme_excerpt}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="py-16 text-center space-y-3">
              <BookOpen className="w-10 h-10 text-on-surface-variant/30 mx-auto" />
              <p className="text-sm font-medium text-on-surface-variant">暂未获取到 README 内容</p>
              <button
                type="button"
                onClick={() => void onLoadOverview(repo, true)}
                className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-highest text-xs font-semibold text-on-surface cursor-pointer"
              >
                重试拉取
              </button>
            </div>
          )
        )}
      </div>
    </div>
  )
}
