/**
 * useTrending — Dev Trending v2 状态管理 Hook
 * 封装多周期榜单、板块分类排名、排序搜索、README 拉取与 AI 深度速读卡
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import * as trendingService from '@/services/trendingService'
import type {
  TrendingCategoryId,
  TrendingPeriod,
  TrendingRepo,
  TrendingSortBy,
} from '@/types/trending'
import {
  DEFAULT_RADAR_KEYWORDS,
  matchRadarKeywords,
  parseRepoDeepDive,
  resolveRepoCategory,
  sortTrendingRepos,
  TRENDING_CATEGORIES,
  TRENDING_PERIODS,
} from '@/lib/trendingCategory'
import { showToast } from '@/store/useToastStore'
import { useButlerStore } from '@/stores/butlerStore'
import { useAppStore } from '@/stores/useAppStore'

const isTauriApp = isTauri()

export function useTrending() {
  const [period, setPeriod] = useState<TrendingPeriod>('past_week')
  const [sortBy, setSortBy] = useState<TrendingSortBy>('stars')
  const [categoryFilter, setCategoryFilter] = useState<TrendingCategoryId>('all')
  const [languageFilter, setLanguageFilter] = useState('All')
  const [searchKeyword, setSearchKeyword] = useState('')

  const [repos, setRepos] = useState<TrendingRepo[]>([])
  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [summarizing, setSummarizing] = useState(false)
  const [loadingOverviewId, setLoadingOverviewId] = useState<number | null>(null)
  const [generatingDeepDiveId, setGeneratingDeepDiveId] = useState<number | null>(null)
  const [savedRepoIds, setSavedRepoIds] = useState<Set<string>>(() => new Set())
  const [radarKeywords, setRadarKeywords] = useState<string[]>(DEFAULT_RADAR_KEYWORDS)
  const [exportingDigest, setExportingDigest] = useState(false)
  const [lastFetched, setLastFetched] = useState<string | null>(null)
  const activePeriodRef = useRef<TrendingPeriod>(period)

  useEffect(() => {
    activePeriodRef.current = period
  }, [period])

  useEffect(() => {
    if (!isTauriApp) return
    void trendingService.loadRadarKeywords().then(setRadarKeywords).catch(() => {})
  }, [])

  // ─── 按周期加载数据 ────────────────────────────

  const loadForPeriod = useCallback(async (targetPeriod: TrendingPeriod) => {
    if (!isTauriApp) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const needs = await trendingService.needsRefresh(targetPeriod)
      if (needs) {
        try {
          await trendingService.fetchAndCacheTrending(targetPeriod)
        } catch (err) {
          console.warn('Trending API 获取失败，尝试加载缓存:', err)
        }
      }

      let list = await trendingService.getTrendingList(targetPeriod)
      if (list.length === 0) {
        list = await trendingService.getLatestTrendingList(targetPeriod)
      }

      if (activePeriodRef.current !== targetPeriod) return
      setRepos(list)
      setSelectedRepoId(prev => (prev && list.some(item => item.id === prev) ? prev : null))
      setLastFetched(list.length > 0 ? list[0].fetched_date : null)

      trendingService.cleanOldData(14).catch(() => {})
    } catch (err) {
      showToast(`加载 Trending 失败: ${String(err)}`, 'error')
    } finally {
      if (activePeriodRef.current === targetPeriod) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void loadForPeriod(period)
  }, [period, loadForPeriod])

  // ─── 手动刷新当前周期 ──────────────────────────

  const refresh = useCallback(async () => {
    if (!isTauriApp) return
    setRefreshing(true)
    try {
      await trendingService.fetchAndCacheTrending(period)
      const list = await trendingService.getTrendingList(period)
      setRepos(list)
      setLastFetched(list.length > 0 ? list[0].fetched_date : null)
      showToast('榜单数据已更新', 'success')
    } catch (err) {
      showToast(`刷新失败: ${String(err)}`, 'error')
    } finally {
      setRefreshing(false)
    }
  }, [period])

  // ─── 批量 AI 摘要与精准分类 ────────────────────

  const generateSummaries = useCallback(async () => {
    if (!isTauriApp) return
    setSummarizing(true)
    try {
      await trendingService.generateAiSummaries(repos)
      const list = await trendingService.getLatestTrendingList(period)
      setRepos(list)
      showToast('AI 摘要与板块分类已生成', 'success')
    } catch (err) {
      const msg = String(err)
      if (msg.includes('API Key')) {
        showToast('请先在设置中配置 AI API Key', 'error')
      } else {
        showToast(`摘要生成失败: ${msg}`, 'error')
      }
    } finally {
      setSummarizing(false)
    }
  }, [period, repos])

  // ─── 单条仓库 README & 元信息拉取 ──────────────

  const loadRepoOverview = useCallback(async (repo: TrendingRepo, forceRefresh = false) => {
    if (!isTauriApp) return repo
    setLoadingOverviewId(repo.id)
    try {
      const updated = await trendingService.fetchRepoOverview(repo, forceRefresh)
      setRepos(prev => prev.map(item => (item.id === updated.id ? updated : item)))
      return updated
    } catch (err) {
      showToast(`获取 README 失败: ${String(err)}`, 'error')
      return repo
    } finally {
      setLoadingOverviewId(curr => (curr === repo.id ? null : curr))
    }
  }, [])

  // ─── 单条仓库 AI 深度速读卡生成 ────────────────

  const generateDeepDive = useCallback(async (repo: TrendingRepo, forceRefresh = false) => {
    if (!isTauriApp) return repo
    setGeneratingDeepDiveId(repo.id)
    try {
      const updated = await trendingService.generateRepoDeepDive(repo, forceRefresh)
      setRepos(prev => prev.map(item => (item.id === updated.id ? updated : item)))
      showToast('AI 项目速读卡已生成', 'success')
      return updated
    } catch (err) {
      const msg = String(err)
      if (msg.includes('API Key')) {
        showToast('请先在设置中配置 AI API Key', 'error')
      } else {
        showToast(`速读卡生成失败: ${msg}`, 'error')
      }
      return repo
    } finally {
      setGeneratingDeepDiveId(curr => (curr === repo.id ? null : curr))
    }
  }, [])

  // ─── 收藏到灵感 / 转待办 / 问 Butler / 雷达 / 导出 ──

  const saveToIdea = useCallback(async (repo: TrendingRepo) => {
    try {
      await trendingService.saveToIdea(repo)
      setSavedRepoIds(prev => new Set(prev).add(repo.repo_id))
      showToast('已收藏到灵感便签', 'success')
    } catch (err) {
      showToast(`收藏失败: ${String(err)}`, 'error')
    }
  }, [])

  const saveToTodo = useCallback(async (repo: TrendingRepo) => {
    try {
      const todoId = await trendingService.saveToTodo(repo)
      showToast('已加入待办清单', 'success')
      return todoId
    } catch (err) {
      showToast(`加入待办失败: ${String(err)}`, 'error')
      return null
    }
  }, [])

  const askButler = useCallback((repo: TrendingRepo) => {
    const deepDive = parseRepoDeepDive(repo.ai_deep_dive)
    const parts = [
      `项目名称：${repo.repo_name}`,
      `语言：${repo.language || '未知'} | Stars：+${repo.stars} | Forks：${repo.forks}`,
      `仓库简介：${repo.description || '无'}`,
      deepDive
        ? `AI 速读定位：${deepDive.one_liner}\n解决痛点：${deepDive.problem}\n核心亮点：${deepDive.highlights.join('；')}\n上手方式：${deepDive.quickstart}\n同类对比：${deepDive.comparison}`
        : repo.ai_summary_zh
        ? `AI 摘要：${repo.ai_summary_zh}`
        : '',
      repo.readme_excerpt ? `README 节选：\n${repo.readme_excerpt.slice(0, 2200)}` : '',
    ].filter(Boolean)

    useButlerStore.getState().setDraftContext({
      title: `GitHub: ${repo.repo_name}`,
      content: parts.join('\n\n'),
      suggestedPrompt: `请结合 ${repo.repo_name} 的特点，帮我分析它的适用场景、核心优缺点，以及值不值得在项目中引入？`,
    })
    useAppStore.getState().setButlerActive(true)
  }, [])

  const addRadarKeyword = useCallback(async (keyword: string) => {
    const trimmed = keyword.trim()
    if (!trimmed) return
    const next = Array.from(new Set([...radarKeywords, trimmed]))
    setRadarKeywords(next)
    if (isTauriApp) {
      await trendingService.saveRadarKeywords(next).catch(() => {})
    }
  }, [radarKeywords])

  const removeRadarKeyword = useCallback(async (keyword: string) => {
    const next = radarKeywords.filter(k => k !== keyword)
    setRadarKeywords(next)
    if (isTauriApp) {
      await trendingService.saveRadarKeywords(next).catch(() => {})
    }
  }, [radarKeywords])

  const exportDigest = useCallback(async () => {
    if (repos.length === 0) {
      showToast('当前榜单暂无可导出数据', 'info')
      return
    }
    setExportingDigest(true)
    try {
      const periodLabel = TRENDING_PERIODS.find(p => p.id === period)?.label ?? '热点'
      const sorted = sortTrendingRepos(repos, sortBy)
      const res = await trendingService.exportTrendingDigest({
        periodLabel,
        repos: sorted,
        radarKeywords,
      })
      if (res.target === 'obsidian') {
        showToast(`已导出热点周报到 Obsidian`, 'success')
      } else {
        showToast('未配置 Obsidian 路径，已将 Markdown 周报复制到剪贴板', 'success')
      }
    } catch (err) {
      showToast(`导出周报失败: ${String(err)}`, 'error')
    } finally {
      setExportingDigest(false)
    }
  }, [period, radarKeywords, repos, sortBy])

  // ─── 板块数量统计 ──────────────────────────────

  const categoryCounts = useMemo(() => {
    const counts: Record<TrendingCategoryId, number> = {
      all: repos.length,
      radar: 0,
      ai: 0,
      devtools: 0,
      frontend: 0,
      backend: 0,
      desktop: 0,
      security: 0,
      other: 0,
    }
    for (const r of repos) {
      if (matchRadarKeywords(r, radarKeywords).length > 0) {
        counts.radar += 1
      }
      const cat = resolveRepoCategory(r)
      counts[cat] += 1
    }
    return counts
  }, [repos, radarKeywords])

  // ─── 过滤 + 排序 ───────────────────────────────

  const filteredRepos = useMemo(() => {
    const filtered = repos.filter(r => {
      if (categoryFilter === 'radar') {
        if (matchRadarKeywords(r, radarKeywords).length === 0) return false
      } else if (categoryFilter !== 'all' && resolveRepoCategory(r) !== categoryFilter) {
        return false
      }
      if (languageFilter !== 'All' && r.language !== languageFilter) return false
      if (searchKeyword.trim()) {
        const kw = searchKeyword.trim().toLowerCase()
        return (
          r.repo_name.toLowerCase().includes(kw) ||
          r.description.toLowerCase().includes(kw) ||
          (r.ai_summary_zh?.toLowerCase().includes(kw) ?? false) ||
          (r.ai_tags?.toLowerCase().includes(kw) ?? false)
        )
      }
      return true
    })
    return sortTrendingRepos(filtered, sortBy)
  }, [repos, categoryFilter, radarKeywords, languageFilter, searchKeyword, sortBy])

  const selectedRepo = useMemo(
    () => repos.find(r => r.id === selectedRepoId) ?? null,
    [repos, selectedRepoId],
  )

  const availableLanguages = useMemo(() => {
    const langs = new Set(repos.map(r => r.language).filter(Boolean))
    return ['All', ...Array.from(langs).sort()]
  }, [repos])

  const hasPendingSummaries = useMemo(
    () => repos.some(r => !r.ai_summary_zh),
    [repos],
  )

  const topCategoryBreakdown = useMemo(() => {
    return TRENDING_CATEGORIES
      .filter(c => c.id !== 'all' && c.id !== 'radar' && categoryCounts[c.id] > 0)
      .map(c => ({ ...c, count: categoryCounts[c.id] }))
      .sort((a, b) => b.count - a.count)
  }, [categoryCounts])

  return {
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
    repos: filteredRepos,
    allRepos: repos,
    totalCount: repos.length,
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
  }
}
