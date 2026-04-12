/**
 * useTrending — Dev Trending 页面状态管理 Hook
 * 封装数据加载、筛选、AI 摘要生成和收藏操作
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import * as trendingService from '@/services/trendingService'
import type { TrendingRepo } from '@/types/trending'
import { showToast } from '@/store/useToastStore'

const isTauriApp = isTauri()

export function useTrending() {
  const [repos, setRepos] = useState<TrendingRepo[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [summarizing, setSummarizing] = useState(false)
  const [languageFilter, setLanguageFilter] = useState('All')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [lastFetched, setLastFetched] = useState<string | null>(null)

  // ─── 初始化加载 ─────────────────────────────────

  const initLoad = useCallback(async () => {
    if (!isTauriApp) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      // 检查是否需要刷新
      const needs = await trendingService.needsRefresh()
      if (needs) {
        try {
          await trendingService.fetchAndCacheTrending()
        } catch (err) {
          console.warn('Trending API 获取失败，尝试加载缓存:', err)
          // API 失败不阻塞，继续加载本地缓存
        }
      }

      // 从本地加载数据（优先今天，否则取最新）
      let list = await trendingService.getTrendingList()
      if (list.length === 0) {
        list = await trendingService.getLatestTrendingList()
      }
      setRepos(list)

      if (list.length > 0) {
        setLastFetched(list[0].fetched_date)
      }

      // 后台清理旧数据
      trendingService.cleanOldData(7).catch(() => {})
    } catch (err) {
      showToast(`加载 Trending 失败: ${String(err)}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    initLoad()
  }, [initLoad])

  // ─── 手动刷新 ─────────────────────────────────

  const refresh = useCallback(async () => {
    if (!isTauriApp) return
    setRefreshing(true)
    try {
      await trendingService.fetchAndCacheTrending()
      const list = await trendingService.getTrendingList()
      setRepos(list)
      if (list.length > 0) {
        setLastFetched(list[0].fetched_date)
      }
      showToast('数据已刷新', 'success')
    } catch (err) {
      showToast(`刷新失败: ${String(err)}`, 'error')
    } finally {
      setRefreshing(false)
    }
  }, [])

  // ─── AI 摘要生成 ───────────────────────────────

  const generateSummaries = useCallback(async () => {
    if (!isTauriApp) return
    setSummarizing(true)
    try {
      await trendingService.generateAiSummaries(repos)
      // 重新加载列表以获取更新后的摘要
      const list = await trendingService.getLatestTrendingList()
      setRepos(list)
      showToast('AI 摘要生成完成', 'success')
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
  }, [repos])

  // ─── 收藏到灵感 ───────────────────────────────

  const saveToIdea = useCallback(async (repo: TrendingRepo) => {
    try {
      await trendingService.saveToIdea(repo)
      showToast('已收藏到灵感', 'success')
    } catch (err) {
      showToast(`收藏失败: ${String(err)}`, 'error')
    }
  }, [])

  // ─── 过滤逻辑 ─────────────────────────────────

  const filteredRepos = useMemo(() => {
    return repos.filter(r => {
      // 语言筛选
      if (languageFilter !== 'All' && r.language !== languageFilter) return false
      // 关键词搜索
      if (searchKeyword) {
        const kw = searchKeyword.toLowerCase()
        return (
          r.repo_name.toLowerCase().includes(kw) ||
          r.description.toLowerCase().includes(kw) ||
          (r.ai_summary_zh?.toLowerCase().includes(kw) ?? false)
        )
      }
      return true
    })
  }, [repos, languageFilter, searchKeyword])

  // ─── 可用语言列表 ─────────────────────────────

  const availableLanguages = useMemo(() => {
    const langs = new Set(repos.map(r => r.language).filter(Boolean))
    return ['All', ...Array.from(langs).sort()]
  }, [repos])

  // ─── 统计 ─────────────────────────────────────

  const hasPendingSummaries = useMemo(() => {
    return repos.some(r => !r.ai_summary_zh)
  }, [repos])

  return {
    repos: filteredRepos,
    totalCount: repos.length,
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
  }
}
