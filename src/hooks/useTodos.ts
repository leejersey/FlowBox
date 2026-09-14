/**
 * Todo 业务 Hook — 封装 todoService 供组件使用
 */

import { useState, useEffect, useCallback } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import type { Todo, CreateTodoPayload, UpdateTodoPayload, TodoListQuery } from '../types/todo'
import * as todoService from '../services/todoService'
import { updateTodoAndRefresh } from '../lib/todoOptimisticUpdate'
import { showToast } from '@/store/useToastStore'

// 检测是否在 Tauri 环境中（兼容 Tauri v2）
const isTauriApp = isTauri()

export function useTodos(query: TodoListQuery = {}) {
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { status, priority, keyword, offset, limit } = query

  const refresh = useCallback(async () => {
    if (!isTauriApp) return
    setLoading(true)
    setError(null)
    try {
      const list = await todoService.todoList({ status, priority, keyword, offset, limit })
      setTodos(list)
    } catch (err) {
      setError(String(err))
      showToast(`加载待办失败: ${String(err)}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [status, priority, keyword, offset, limit])

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
      const todo = await updateTodoAndRefresh(
        payload.id,
        () => todoService.todoUpdate(payload),
        refresh,
      )
      showToast('待办已更新', 'success')
      return todo
    } catch (err) {
      showToast(`更新待办失败: ${String(err)}`, 'error')
      throw err
    }
  }, [refresh])

  const remove = useCallback(async (id: number) => {
    let previousTodos: Todo[] = []
    setTodos(prev => {
      previousTodos = prev
      return prev.filter(t => t.id !== id)
    })

    try {
      await todoService.todoDelete(id)
      showToast('待办已删除', 'success')
    } catch (err) {
      setTodos(previousTodos)
      showToast(`删除待办失败: ${String(err)}`, 'error')
      throw err
    }
  }, [])

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
