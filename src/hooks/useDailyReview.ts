/**
 * useDailyReview — 每日回顾定时触发 Hook
 *
 * 每 60 秒检查当前时间是否匹配回顾时间，
 * 确保每天最多触发一次弹窗。
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import * as dailyReviewService from '@/services/dailyReviewService'
import type { DailyReviewData, DailyReviewReport } from '@/services/dailyReviewService'

const CHECK_INTERVAL_MS = 60_000 // 每 60 秒检测一次

export interface UseDailyReviewReturn {
  /** 弹窗是否可见 */
  isOpen: boolean
  /** 关闭弹窗 */
  close: () => void
  /** 手动触发回顾 */
  triggerReview: () => Promise<void>
  /** 当前聚合数据 */
  reviewData: DailyReviewData | null
  /** AI 生成的总结 */
  aiSummary: string
  /** 是否正在加载数据 */
  isLoadingData: boolean
  /** 是否正在生成 AI 总结 */
  isLoadingAi: boolean
  /** 保存回顾 */
  saveReview: () => Promise<void>
  /** 是否已保存 */
  isSaved: boolean
}

export function useDailyReview(): UseDailyReviewReturn {
  const [isOpen, setIsOpen] = useState(false)
  const [reviewData, setReviewData] = useState<DailyReviewData | null>(null)
  const [aiSummary, setAiSummary] = useState('')
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [isLoadingAi, setIsLoadingAi] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const hasAutoTriggeredRef = useRef(false)

  // 执行回顾生成
  const doReview = useCallback(async () => {
    setIsLoadingData(true)
    setAiSummary('')
    setIsSaved(false)

    try {
      const data = await dailyReviewService.gatherTodayData()
      setReviewData(data)
      setIsLoadingData(false)
      setIsOpen(true)

      // 标记今日已弹窗
      await dailyReviewService.markShown()

      // 流式生成 AI 总结
      setIsLoadingAi(true)
      abortRef.current = new AbortController()

      try {
        await dailyReviewService.generateAiSummaryStream(
          data,
          (token) => setAiSummary(prev => prev + token),
          abortRef.current.signal,
        )
      } catch (err) {
        // 如果是用户取消或 API Key 未配置，静默处理
        if (err instanceof Error && err.name !== 'AbortError') {
          console.warn('[DailyReview] AI 总结生成失败:', err.message)
        }
      } finally {
        setIsLoadingAi(false)
      }
    } catch (err) {
      console.error('[DailyReview] 数据聚合失败:', err)
      setIsLoadingData(false)
    }
  }, [])

  // 手动触发
  const triggerReview = useCallback(async () => {
    await doReview()
  }, [doReview])

  // 关闭弹窗
  const close = useCallback(() => {
    setIsOpen(false)
    // 取消进行中的 AI 请求
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
  }, [])

  // 保存回顾
  const saveReview = useCallback(async () => {
    if (!reviewData) return
    const report: DailyReviewReport = {
      data: reviewData,
      aiSummary: aiSummary || null,
      generatedAt: new Date().toISOString(),
    }
    await dailyReviewService.saveReviewReport(report)
    setIsSaved(true)
  }, [reviewData, aiSummary])

  // 定时检测
  useEffect(() => {
    // 应用启动时检查一次，之后每 60 秒检查
    const check = async () => {
      if (hasAutoTriggeredRef.current || isOpen) return

      try {
        const { enabled, time } = await dailyReviewService.getReviewSettings()
        if (!enabled) return

        const hasShown = await dailyReviewService.hasShownToday()
        if (hasShown) return

        const now = new Date()
        const [targetHour, targetMin] = time.split(':').map(Number)

        if (now.getHours() === targetHour && now.getMinutes() >= targetMin) {
          hasAutoTriggeredRef.current = true
          await doReview()
        }
      } catch {
        // 静默 — 浏览器环境或 DB 未就绪
      }
    }

    // 延迟 5 秒后开始检测（等 DB 初始化完成）
    const initialTimeout = setTimeout(check, 5000)
    const interval = setInterval(check, CHECK_INTERVAL_MS)

    return () => {
      clearTimeout(initialTimeout)
      clearInterval(interval)
    }
  }, [doReview, isOpen])

  // 每天零点重置自动触发标记
  useEffect(() => {
    const resetAtMidnight = () => {
      const now = new Date()
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(0, 0, 0, 0)
      const msUntilMidnight = tomorrow.getTime() - now.getTime()

      return setTimeout(() => {
        hasAutoTriggeredRef.current = false
      }, msUntilMidnight)
    }

    const timer = resetAtMidnight()
    return () => clearTimeout(timer)
  }, [])

  return {
    isOpen,
    close,
    triggerReview,
    reviewData,
    aiSummary,
    isLoadingData,
    isLoadingAi,
    saveReview,
    isSaved,
  }
}
