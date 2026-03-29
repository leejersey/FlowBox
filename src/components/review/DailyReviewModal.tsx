/**
 * DailyReviewModal — AI 每日回顾弹窗
 *
 * 展示今日各模块统计 + AI 洞察总结
 */

import { useEffect, useRef } from 'react'
import { X, Sparkles, Save, AlertTriangle, CheckCircle2, Moon } from 'lucide-react'
import type { DailyReviewData } from '@/services/dailyReviewService'
import './DailyReviewModal.css'

interface DailyReviewModalProps {
  isOpen: boolean
  onClose: () => void
  reviewData: DailyReviewData | null
  aiSummary: string
  isLoadingData: boolean
  isLoadingAi: boolean
  onSave: () => Promise<void>
  isSaved: boolean
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const month = d.getMonth() + 1
  const day = d.getDate()
  const weekday = weekdays[d.getDay()]
  return `${month}月${day}日 ${weekday}`
}

export function DailyReviewModal({
  isOpen,
  onClose,
  reviewData,
  aiSummary,
  isLoadingData,
  isLoadingAi,
  onSave,
  isSaved,
}: DailyReviewModalProps) {
  const cardRef = useRef<HTMLDivElement>(null)

  // ESC 关闭
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const data = reviewData

  return (
    <div
      className="review-overlay fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* 卡片 */}
      <div
        ref={cardRef}
        className="review-card relative w-full max-w-[540px] max-h-[90vh] overflow-y-auto rounded-[28px] border border-white/15 shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.92))',
          backdropFilter: 'blur(40px)',
        }}
      >
        {/* 顶部装饰光晕 */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-8 w-20 h-20 bg-violet-500/15 rounded-full blur-2xl pointer-events-none" />

        {/* 头部 */}
        <div className="relative px-8 pt-8 pb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Moon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-display font-bold text-white">今日回顾</h2>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                {data ? formatDate(data.date) : '加载中...'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 加载中 */}
        {isLoadingData && (
          <div className="px-8 py-16 flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-sm text-slate-400 font-medium">正在汇总今日数据...</p>
          </div>
        )}

        {/* 统计卡片 */}
        {data && !isLoadingData && (
          <div className="px-8 pb-2">
            <div className="grid grid-cols-2 gap-3">
              {/* 待办 */}
              <StatCard
                emoji="📋"
                label="待办完成"
                value={`${data.todosCompleted}/${data.todosTotal}`}
                sub={`完成率 ${data.completionRate}%`}
                gradient="from-blue-500/15 to-blue-600/5"
                delay={0}
              />

              {/* 灵感 */}
              <StatCard
                emoji="💡"
                label="灵感捕获"
                value={`${data.ideasCaptured}`}
                sub="条新灵感"
                gradient="from-amber-500/15 to-amber-600/5"
                delay={1}
              />

              {/* 番茄 */}
              <StatCard
                emoji="🍅"
                label="番茄专注"
                value={`${data.pomodoroCount}`}
                sub={`共 ${data.totalFocusMinutes} 分钟`}
                gradient="from-rose-500/15 to-rose-600/5"
                delay={2}
              />

              {/* 语音 */}
              <StatCard
                emoji="🎙️"
                label="语音备忘"
                value={`${data.voiceRecorded}`}
                sub="段录音"
                gradient="from-emerald-500/15 to-emerald-600/5"
                delay={3}
              />
            </div>

            {/* 滞留待办警告 */}
            {data.stalledTodos.length > 0 && (
              <div className="mt-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20" style={{ animationDelay: '0.5s' }}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-bold text-amber-300">⚡ 滞留提醒</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {data.stalledTodos.map((todo) => (
                    <div key={todo.id} className="flex items-center gap-2 text-sm text-amber-200/80">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                      <span className="truncate flex-1">{todo.title}</span>
                      <span className="text-xs text-amber-400/70 shrink-0">{todo.days}天</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* AI 洞察区域 */}
        {data && !isLoadingData && (
          <div className="px-8 py-4">
            <div className="relative rounded-2xl overflow-hidden border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 to-violet-500/5">
              {/* 流光背景 */}
              {isLoadingAi && <div className="absolute inset-0 review-ai-shimmer" />}

              <div className="relative p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span className="text-sm font-bold text-indigo-300">AI 洞察</span>
                </div>

                {!aiSummary && isLoadingAi && (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <div className="w-4 h-4 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
                    <span>AI 正在分析你今天的表现...</span>
                  </div>
                )}

                {!aiSummary && !isLoadingAi && (
                  <p className="text-sm text-slate-400 leading-relaxed">
                    未配置 AI API Key，无法生成 AI 洞察。请前往设置 → AI 模型配置中填写。
                  </p>
                )}

                {aiSummary && (
                  <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {aiSummary}
                    {isLoadingAi && <span className="review-cursor" />}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 底部操作栏 */}
        {data && !isLoadingData && (
          <div className="px-8 pb-8 pt-2 flex items-center gap-3">
            <button
              onClick={onSave}
              disabled={isSaved}
              className={`flex-1 h-12 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                isSaved
                  ? 'bg-emerald-500/20 text-emerald-300 cursor-default'
                  : 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white hover:opacity-90 shadow-lg shadow-indigo-500/25'
              }`}
            >
              {isSaved ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  已保存
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  保存回顾
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="h-12 px-6 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors text-sm font-medium text-slate-300 border border-white/10"
            >
              关闭
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 统计子卡片 ─────────────────────────────────

interface StatCardProps {
  emoji: string
  label: string
  value: string
  sub: string
  gradient: string
  delay: number
}

function StatCard({ emoji, label, value, sub, gradient, delay }: StatCardProps) {
  return (
    <div
      className={`review-stat-value rounded-2xl p-4 bg-gradient-to-br ${gradient} border border-white/5`}
      style={{ animationDelay: `${0.15 + delay * 0.1}s` }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">{emoji}</span>
        <span className="text-xs font-medium text-slate-400">{label}</span>
      </div>
      <p className="text-2xl font-display font-bold text-white">{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  )
}
