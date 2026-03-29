/**
 * useIdeas — Idea 模块状态管理 Hook
 * 封装对 ideaService 的所有读写操作及异常处理 Toast
 */

import { useState, useCallback, useEffect } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import * as ideaService from '@/services/ideaService'
import type { Idea, IdeaListQuery } from '@/types/idea'
import { showToast } from '@/store/useToastStore'

const isTauriApp = isTauri()

export function useIdeas(initialQuery: IdeaListQuery = { is_archived: false }) {
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState(initialQuery)

  const refresh = useCallback(async () => {
    if (!isTauriApp) return
    setLoading(true)
    try {
      const list = await ideaService.ideaList(query)
      setIdeas(list)
    } catch (err) {
      showToast(`获取灵感失败: ${String(err)}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createIdea = useCallback(async (content: string, tags: string[] = []) => {
    if (!content.trim()) return
    try {
      await ideaService.ideaCreate(content.trim(), tags)
      showToast('已保存灵感', 'success')
      await refresh()
    } catch (err) {
      showToast(`保存失败: ${String(err)}`, 'error')
    }
  }, [refresh])

  const updateIdea = useCallback(async (id: number, data: { content?: string; tags?: string[] }) => {
    try {
      await ideaService.ideaUpdate(id, data)
      await refresh()
    } catch (err) {
      showToast(`更新失败: ${String(err)}`, 'error')
    }
  }, [refresh])

  const archiveIdea = useCallback(async (id: number) => {
    try {
      await ideaService.ideaArchive(id, true)
      showToast('已归档', 'info')
      await refresh()
    } catch (err) {
      showToast(`归档失败: ${String(err)}`, 'error')
    }
  }, [refresh])

  const deleteIdea = useCallback(async (id: number) => {
    try {
      await ideaService.ideaDelete(id)
      showToast('已删除灵感', 'info')
      await refresh()
    } catch (err) {
      showToast(`删除失败: ${String(err)}`, 'error')
    }
  }, [refresh])

  return {
    ideas,
    loading,
    query,
    setQuery,
    refresh,
    createIdea,
    updateIdea,
    archiveIdea,
    deleteIdea,
  }
}
