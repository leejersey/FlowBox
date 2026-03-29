/**
 * useScreenshotOcr — 截图 OCR 工作流 Hook
 *
 * 管理截图捕获 → AI 识别 → 用户选择 → 保存 的完整状态机
 */

import { useState, useCallback, useEffect } from 'react'
import * as screenshotOcrService from '@/services/screenshotOcrService'
import type { OcrResult } from '@/services/screenshotOcrService'
import { showToast } from '@/store/useToastStore'

export type OcrStep = 'idle' | 'capturing' | 'recognizing' | 'result' | 'saving' | 'done'

export interface UseScreenshotOcrReturn {
  /** 当前步骤 */
  step: OcrStep
  /** OCR 结果 */
  ocrResult: OcrResult | null
  /** 面板是否可见 */
  isOpen: boolean
  /** 错误信息 */
  error: string | null
  /** 开始截图 OCR 流程 */
  startCapture: () => Promise<void>
  /** 从已有图片路径开始 OCR */
  startFromImage: (imagePath: string) => Promise<void>
  /** 保存为灵感 */
  saveAsIdea: () => Promise<void>
  /** 保存为待办 */
  saveAsTodo: () => Promise<void>
  /** 关闭面板 */
  close: () => void
  /** 编辑识别文本 */
  updateText: (text: string) => void
  /** 编辑标题 */
  updateTitle: (title: string) => void
}

export function useScreenshotOcr(): UseScreenshotOcrReturn {
  const [step, setStep] = useState<OcrStep>('idle')
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 从剪贴板捕获截图并识别
  const startCapture = useCallback(async () => {
    setError(null)
    setStep('capturing')
    setIsOpen(true)

    try {
      const imagePath = await screenshotOcrService.captureFromClipboard()
      setStep('recognizing')

      const result = await screenshotOcrService.recognizeScreenshot(imagePath)
      setOcrResult(result)
      setStep('result')
    } catch (err) {
      const msg = err instanceof Error ? err.message : '截图识别失败'
      setError(msg)
      setStep('idle')
      showToast(msg, 'error')
    }
  }, [])

  // 从已有图片路径开始识别
  const startFromImage = useCallback(async (imagePath: string) => {
    setError(null)
    setStep('recognizing')
    setIsOpen(true)

    try {
      const result = await screenshotOcrService.recognizeScreenshot(imagePath)
      setOcrResult(result)
      setStep('result')
    } catch (err) {
      const msg = err instanceof Error ? err.message : '图片识别失败'
      setError(msg)
      setStep('idle')
      showToast(msg, 'error')
    }
  }, [])

  // 保存为灵感
  const saveAsIdea = useCallback(async () => {
    if (!ocrResult) return
    setStep('saving')
    try {
      await screenshotOcrService.saveAsIdea(ocrResult)
      setStep('done')
      showToast('已保存为灵感 💡', 'success')
      // 自动关闭
      setTimeout(() => {
        setIsOpen(false)
        setStep('idle')
        setOcrResult(null)
      }, 1200)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '保存失败'
      setError(msg)
      setStep('result')
      showToast(msg, 'error')
    }
  }, [ocrResult])

  // 保存为待办
  const saveAsTodo = useCallback(async () => {
    if (!ocrResult) return
    setStep('saving')
    try {
      await screenshotOcrService.saveAsTodo(ocrResult)
      setStep('done')
      showToast('已创建待办 📋', 'success')
      // 自动关闭
      setTimeout(() => {
        setIsOpen(false)
        setStep('idle')
        setOcrResult(null)
      }, 1200)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '保存失败'
      setError(msg)
      setStep('result')
      showToast(msg, 'error')
    }
  }, [ocrResult])

  // 关闭面板
  const close = useCallback(() => {
    setIsOpen(false)
    setStep('idle')
    setOcrResult(null)
    setError(null)
  }, [])

  // 编辑功能
  const updateText = useCallback((text: string) => {
    setOcrResult(prev => prev ? { ...prev, rawText: text } : null)
  }, [])

  const updateTitle = useCallback((title: string) => {
    setOcrResult(prev => prev ? { ...prev, suggestedTitle: title } : null)
  }, [])

  // 注册全局快捷键 Ctrl+Shift+S (仅在主窗口)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault()
        startCapture()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [startCapture])

  return {
    step,
    ocrResult,
    isOpen,
    error,
    startCapture,
    startFromImage,
    saveAsIdea,
    saveAsTodo,
    close,
    updateText,
    updateTitle,
  }
}
