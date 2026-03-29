import { X, ArrowRightLeft } from 'lucide-react'
import type { ClipboardItem } from '@/types/clipboard'

interface ClipDiffModalProps {
  itemA: ClipboardItem
  itemB: ClipboardItem
  onClose: () => void
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时前`
  return `${Math.floor(hours / 24)}天前`
}

export function ClipDiffModal({ itemA, itemB, onClose }: ClipDiffModalProps) {
  // 确保 A 总是旧版本，B 总是新版本
  const isAOlder = new Date(itemA.created_at).getTime() < new Date(itemB.created_at).getTime()
  const oldItem = isAOlder ? itemA : itemB
  const newItem = isAOlder ? itemB : itemA

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-surface/50 backdrop-blur-md animate-fade-in" onClick={onClose}>
      <div 
        className="bg-surface border border-white/20 shadow-2xl rounded-3xl w-full max-w-6xl h-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-container-highest shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-on-surface leading-tight">对比变更</h2>
              <p className="text-xs text-on-surface-variant font-medium mt-0.5">左侧为旧版本，右侧为新版本</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Diff Body */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-surface-container-highest">
          
          {/* Left: Old */}
          <div className="flex flex-col h-full overflow-hidden bg-surface-container-low/50">
            <div className="p-3 bg-red-500/10 border-b border-red-500/10 text-red-600 flex items-center justify-between shrink-0">
              <span className="text-sm font-bold">旧版本 (Old)</span>
              <span className="text-xs font-medium opacity-80">{timeAgo(oldItem.created_at)}</span>
            </div>
            <div className="flex-1 overflow-auto p-4 custom-scrollbar">
              <pre className="text-sm font-mono text-on-surface-variant whitespace-pre-wrap break-all">
                {oldItem.text_content || oldItem.ocr_text || '无文本内容'}
              </pre>
            </div>
          </div>

          {/* Right: New */}
          <div className="flex flex-col h-full overflow-hidden bg-surface-container-low/50">
            <div className="p-3 bg-emerald-500/10 border-b border-emerald-500/10 text-emerald-600 flex items-center justify-between shrink-0">
              <span className="text-sm font-bold">新版本 (New)</span>
              <span className="text-xs font-medium opacity-80">{timeAgo(newItem.created_at)}</span>
            </div>
            <div className="flex-1 overflow-auto p-4 custom-scrollbar">
              <pre className="text-sm font-mono text-on-surface whitespace-pre-wrap break-all">
                {newItem.text_content || newItem.ocr_text || '无文本内容'}
              </pre>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-end border-t border-surface-container-highest shrink-0 bg-surface">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-sm font-bold bg-surface-container text-on-surface hover:bg-surface-container-highest transition-colors"
          >
            关闭
          </button>
        </div>

      </div>
    </div>
  )
}
