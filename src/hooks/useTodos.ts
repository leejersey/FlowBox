/**
 * Todo 业务 Hook — 封装 todoService 供组件使用
 */

import { useState, useEffect, useCallback } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import type { Todo, CreateTodoPayload, UpdateTodoPayload, TodoListQuery } from '../types/todo'
import * as todoService from '../services/todoService'
import { showToast } from '@/store/useToastStore'

// 检测是否在 Tauri 环境中（兼容 Tauri v2）
const isTauriApp = isTauri()

export function useTodos(query: TodoListQuery = {}) {
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!isTauriApp) return
    setLoading(true)
    setError(null)
    try {
      const list = await todoService.todoList(query)
      setTodos(list)
    } catch (err) {
      setError(String(err))
      showToast(`加载待办失败: ${String(err)}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [query.status, query.priority, query.keyword, query.offset, query.limit])

  useEffect(() => {
    refresh()
  }, [refresh])

  const create = useCallback(async (payload: CreateTodoPayload) => {
    try {
      const todo = await todoService.todoCreate(payload)
      await refresh()
      showToast('新建待办成功', 'success')
      return todo
    } catch (err) {
      showToast(`新建待办失败: ${String(err)}`, 'error')
      throw err
    }
  }, [refresh])

  const update = useCallback(async (payload: UpdateTodoPayload) => {
    try {
      const todo = await todoService.todoUpdate(payload)
      await refresh()
      showToast('待办已更新', 'success')
      return todo
    } catch (err) {
      showToast(`更新待办失败: ${String(err)}`, 'error')
      throw err
    }
  }, [refresh])

  const remove = useCallback(async (id: number) => {
    try {
      await todoService.todoDelete(id)
      await refresh()
      showToast('待办已删除', 'success')
    } catch (err) {
      showToast(`删除待办失败: ${String(err)}`, 'error')
      throw err
    }
  }, [refresh])

  const batchUpdateStatus = useCallback(async (
    ids: number[],
    status: 'pending' | 'in_progress' | 'done'
  ) => {
    try {
      await todoService.todoBatchUpdateStatus(ids, status)
      await refresh()
      showToast(`已批量更新 ${ids.length} 项待办状态`, 'success')
    } catch (err) {
      showToast(`批量更新失败: ${String(err)}`, 'error')
      throw err
    }
  }, [refresh])

  return {
    todos,
    loading,
    error,
    refresh,
    create,
    update,
    remove,
    batchUpdateStatus,
  }
}
