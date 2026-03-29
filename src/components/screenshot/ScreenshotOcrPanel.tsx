/**
 * ScreenshotOcrPanel — 截图 OCR 浮窗
 *
 * 展示截图预览 + OCR 识别结果 + 保存操作
 */

import { X, Lightbulb, ListTodo, ScanSearch, CheckCircle2, Camera, Pencil } from 'lucide-react'
import { convertFileSrc, isTauri } from '@tauri-apps/api/core'
import type { OcrStep } from '@/hooks/useScreenshotOcr'
import type { OcrResult } from '@/services/screenshotOcrService'
import { useState } from 'react'
import './ScreenshotOcrPanel.css'

interface ScreenshotOcrPanelProps {
  isOpen: boolean
  step: OcrStep
  ocrResult: OcrResult | null
  error: string | null
  onSaveAsIdea: () => void
  onSaveAsTodo: () => void
  onClose: () => void
  onUpdateText: (text: string) => void
  onUpdateTitle: (title: string) => void
}

function getImageSrc(imagePath: string): string {
  if (isTauri()) {
    return convertFileSrc(imagePath)
  }
  return imagePath
}

export function ScreenshotOcrPanel({
  isOpen,
  step,
  ocrResult,
  error,
  onSaveAsIdea,
  onSaveAsTodo,
  onClose,
  onUpdateText,
  onUpdateTitle,
}: ScreenshotOcrPanelProps) {
  const [isEditingText, setIsEditingText] = useState(false)
  const [isEditingTitle, setIsEditingTitle] = useState(false)

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* 面板 */}
      <div
        className="ocr-panel-enter relative w-full max-w-[480px] max-h-[85vh] overflow-y-auto rounded-[24px] border border-white/15 shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.94))',
          backdropFilter: 'blur(40px)',
        }}
      >
        {/* 顶部装饰 */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* 头部 */}
        <div className="relative px-6 pt-6 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
              <ScanSearch className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-display font-bold text-white">截图识别</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {step === 'capturing' && '正在捕获截图…'}
                {step === 'recognizing' && 'AI 识别中…'}
                {step === 'result' && '识别完成'}
                {step === 'saving' && '正在保存…'}
                {step === 'done' && '保存成功！'}
                {step === 'idle' && error && '识别失败'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 捕获中 / 识别中 状态 */}
        {(step === 'capturing' || step === 'recognizing') && (
          <div className="px-6 py-12 flex flex-col items-center gap-4">
            {step === 'capturing' ? (
              <>
                <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                  <Camera className="w-7 h-7 text-cyan-400 animate-pulse" />
                </div>
                <p className="text-sm text-slate-300 text-center">正在从剪贴板获取截图…</p>
              </>
            ) : (
              <>
                <div className="relative w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center overflow-hidden">
                  <ScanSearch className="w-7 h-7 text-indigo-400" />
                  <div className="ocr-scan-line" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 ocr-dot-pulse" />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 ocr-dot-pulse" />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 ocr-dot-pulse" />
                </div>
                <p className="text-sm text-slate-300 text-center">AI 正在识别图片内容…</p>
              </>
            )}
          </div>
        )}

        {/* 成功状态 */}
        {step === 'done' && (
          <div className="px-6 py-12 flex flex-col items-center gap-3">
            <div className="ocr-success-icon w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
            </div>
            <p className="text-sm text-emerald-300 font-medium">已成功保存！</p>
          </div>
        )}

        {/* 识别结果 */}
        {(step === 'result' || step === 'saving') && ocrResult && (
          <div className="px-6 pb-2">
            {/* 截图预览 */}
            <div className="relative rounded-xl overflow-hidden border border-white/10 mb-4 bg-black/30">
              <img
                src={getImageSrc(ocrResult.imagePath)}
                alt="截图预览"
                className="w-full max-h-40 object-contain"
              />
            </div>

            {/* AI 推荐类型标签 */}
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${
                ocrResult.suggestedType === 'todo'
                  ? 'bg-blue-500/15 text-blue-300 border border-blue-500/20'
                  : 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
              }`}>
                {ocrResult.suggestedType === 'todo' ? '📋 建议创建待办' : '💡 建议保存为灵感'}
              </span>
              {ocrResult.suggestedTags.map(tag => (
                <span key={tag} className="text-[11px] px-2 py-0.5 rounded-md bg-white/5 text-slate-400 border border-white/5">
                  #{tag}
                </span>
              ))}
            </div>

            {/* 标题（可编辑） */}
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">标题</span>
                <button
                  onClick={() => setIsEditingTitle(!isEditingTitle)}
                  className="p-0.5 rounded hover:bg-white/10 transition-colors text-slate-500 hover:text-slate-300"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
              {isEditingTitle ? (
                <input
                  value={ocrResult.suggestedTitle}
                  onChange={e => onUpdateTitle(e.target.value)}
                  onBlur={() => setIsEditingTitle(false)}
                  autoFocus
                  className="w-full h-9 bg-white/5 rounded-lg px-3 text-sm text-white border border-white/10 focus:border-primary/50 focus:outline-none transition-all"
                />
              ) : (
                <p className="text-sm font-bold text-white">{ocrResult.suggestedTitle}</p>
              )}
            </div>

            {/* 识别文本（可编辑） */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">识别内容</span>
                <button
                  onClick={() => setIsEditingText(!isEditingText)}
                  className="p-0.5 rounded hover:bg-white/10 transition-colors text-slate-500 hover:text-slate-300"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
              {isEditingText ? (
                <textarea
                  value={ocrResult.rawText}
                  onChange={e => onUpdateText(e.target.value)}
                  onBlur={() => setIsEditingText(false)}
                  rows={4}
                  autoFocus
                  className="w-full bg-white/5 rounded-lg p-3 text-sm text-slate-200 border border-white/10 focus:border-primary/50 focus:outline-none transition-all resize-none leading-relaxed"
                />
              ) : (
                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                  <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {ocrResult.rawText}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 底部操作栏 */}
        {(step === 'result' || step === 'saving') && ocrResult && (
          <div className="px-6 pb-6 flex items-center gap-3">
            <button
              onClick={onSaveAsIdea}
              disabled={step === 'saving'}
              className="flex-1 h-11 rounded-xl bg-gradient-to-r from-amber-500/80 to-orange-500/80 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              <Lightbulb className="w-4 h-4" />
              存为灵感
            </button>
            <button
              onClick={onSaveAsTodo}
              disabled={step === 'saving'}
              className="flex-1 h-11 rounded-xl bg-gradient-to-r from-blue-500/80 to-indigo-500/80 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
            >
              <ListTodo className="w-4 h-4" />
              创建待办
            </button>
          </div>
        )}

        {/* 错误状态 */}
        {step === 'idle' && error && (
          <div className="px-6 pb-6">
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
