import { useState, useEffect, useCallback, useMemo } from 'react'
import { Search, Pin, Copy, Bot, Trash2, Clock, Code2, Type, Image as ImageIcon, ListChecks, CheckSquare, Square, ArrowRightLeft, X } from 'lucide-react'
import { convertFileSrc, isTauri } from '@tauri-apps/api/core'
import { cn } from '@/lib/utils'
import * as clipboardService from '@/services/clipboardService'
import { showToast } from '@/store/useToastStore'
import type { ClipboardItem } from '@/types/clipboard'
import { useClipboardWatcher } from '@/hooks/useClipboardWatcher'
import { ClipDiffModal } from '@/components/clipboard/ClipDiffModal'

const isTauriApp = isTauri()

function resolveImageSrc(imagePath: string | null): string | null {
  if (!imagePath) return null
  if (imagePath.startsWith('data:') || imagePath.startsWith('file://')) return imagePath
  return isTauriApp ? convertFileSrc(imagePath) : imagePath
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

type FilterKey = 'all' | 'text' | 'code' | 'image' | 'pinned'

function ClipCard({ clip, onPin, onCopy, onDelete, selectable, selected, onSelectToggle }: {
  clip: ClipboardItem
  onPin: (id: number) => void
  onCopy: (clip: ClipboardItem) => void
  onDelete: (id: number) => void
  selectable?: boolean
  selected?: boolean
  onSelectToggle?: (id: number) => void
}) {
  const [imageSrc, setImageSrc] = useState<string | null>(resolveImageSrc(clip.image_path))

  useEffect(() => {
    setImageSrc(resolveImageSrc(clip.image_path))
  }, [clip.image_path])

  const handleCardClick = () => {
    if (selectable && onSelectToggle) {
      onSelectToggle(clip.id)
    }
  }

  return (
    <div 
      onClick={handleCardClick}
      className={cn(
        "group relative bg-surface-container hover:bg-surface-container-highest transition-all duration-300 rounded-[24px] p-6 flex flex-col shadow-sm border",
        selectable ? "cursor-pointer" : "",
        selected ? "border-primary/50 bg-primary/5" : "border-transparent hover:border-white/20"
      )}
    >
      {selectable && (
        <div className="absolute top-5 left-4 z-10 transition-colors">
          {selected ? <CheckSquare className="w-5 h-5 text-primary" /> : <Square className="w-5 h-5 text-on-surface-variant/40 group-hover:text-on-surface-variant" />}
        </div>
      )}
      {clip.is_pinned === 1 && !selectable && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-primary rounded-r-md" />
      )}

      <div className={cn("mb-4 transition-all duration-300", selectable ? "ml-8" : "ml-0")}>
        {clip.content_type === 'text' && (
          <p className="text-[15px] leading-relaxed text-on-surface line-clamp-3">{clip.text_content}</p>
        )}
        {clip.content_type === 'code' && (
          <pre className="bg-surface-container-highest p-4 rounded-xl text-sm font-mono text-on-surface overflow-x-auto shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)]">
            <code>{clip.text_content}</code>
          </pre>
        )}
        {clip.content_type === 'image' && (
          <div className="flex flex-col gap-3">
            {imageSrc ? (
              <img
                src={imageSrc}
                alt="clipboard"
                className="max-h-48 w-full object-contain bg-surface-container-highest rounded-xl border border-white/20"
                loading="lazy"
                onError={() => {
                  if (!clip.image_path) return
                  const fileFallback = `file://${encodeURI(clip.image_path)}`
                  if (imageSrc !== fileFallback) {
                    setImageSrc(fileFallback)
                  }
                }}
              />
            ) : (
              <div className="h-32 bg-surface-container-highest rounded-xl border border-white/20 flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-on-surface-variant/30" />
              </div>
            )}
            {clip.ocr_text && (
              <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
                <div className="flex items-center gap-2 mb-2">
                  <Bot className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold text-primary">AI 识别文本 (OCR)</span>
                </div>
                <p className="text-sm font-mono text-on-surface-variant break-words whitespace-pre-wrap">{clip.ocr_text}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={cn("flex items-center justify-between mt-auto transition-all duration-300", selectable ? "ml-8" : "ml-0")}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-medium">
            <Clock className="w-3.5 h-3.5" />
            {timeAgo(clip.created_at)}
          </div>
          <div className="flex items-center gap-1 text-xs text-on-surface-variant font-medium bg-white/40 px-2 py-0.5 rounded-md">
            {clip.content_type === 'text' && <Type className="w-3.5 h-3.5" />}
            {clip.content_type === 'code' && <Code2 className="w-3.5 h-3.5" />}
            {clip.content_type === 'image' && <ImageIcon className="w-3.5 h-3.5" />}
            <span>{clip.content_type === 'text' ? '文本' : clip.content_type === 'code' ? '代码' : '图片'}</span>
          </div>
          {clip.category && (
            <span className={cn(
              "text-xs font-bold px-2.5 py-1 rounded-md",
              clip.category === '代码' && "bg-violet-500/10 text-violet-600",
              clip.category === '文档' && "bg-blue-500/10 text-blue-600",
              clip.category === '链接' && "bg-cyan-500/10 text-cyan-600",
              clip.category === '命令' && "bg-orange-500/10 text-orange-600",
              clip.category === '笔记' && "bg-green-500/10 text-green-600",
              clip.category === '数据' && "bg-amber-500/10 text-amber-600",
              !['代码','文档','链接','命令','笔记','数据'].includes(clip.category) && "bg-surface-container-low border border-white/30 text-on-surface-variant",
            )}>
              {clip.category}
            </span>
          )}
        </div>

        {!selectable && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0 duration-200">
            <button onClick={(e) => { e.stopPropagation(); onCopy(clip) }} className="p-2 hover:bg-surface-container-highest rounded-lg text-on-surface-variant hover:text-on-surface transition-colors" title="复制">
              <Copy className="w-4 h-4" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onPin(clip.id) }} className="p-2 hover:bg-surface-container-highest rounded-lg text-on-surface-variant hover:text-on-surface transition-colors" title="置顶">
              <Pin className="w-4 h-4" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(clip.id) }} className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-lg text-on-surface-variant transition-colors" title="删除">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function ClipboardPage() {
  const [clips, setClips] = useState<ClipboardItem[]>([])
  const [loading, setLoading] = useState(false)
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')
  const [keyword, setKeyword] = useState('')

  // 多选与重构模式相关状态
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [showDiff, setShowDiff] = useState(false)

  const refresh = useCallback(async () => {
    if (!isTauriApp) return
    setLoading(true)
    try {
      const params: Parameters<typeof clipboardService.clipList>[0] = {}
      if (activeFilter === 'text' || activeFilter === 'code' || activeFilter === 'image') params.content_type = activeFilter
      if (activeFilter === 'pinned') params.is_pinned = true
      if (keyword.trim()) params.keyword = keyword.trim()
      const list = await clipboardService.clipList(params)
      setClips(list)
    } finally {
      setLoading(false)
    }
  }, [activeFilter, keyword])

  useEffect(() => { refresh() }, [refresh])

  // 接入剪贴板监听
  const { watching, toggleWatch } = useClipboardWatcher(refresh)

  const handleCopy = async (clip: ClipboardItem) => {
    if (clip.text_content) {
      try {
        await navigator.clipboard.writeText(clip.text_content)
        showToast('已复制到剪贴板', 'success')
      } catch (err) {
        showToast('复制失败', 'error')
      }
    }
  }

  const handlePin = async (id: number) => {
    await clipboardService.clipTogglePin(id)
    await refresh()
  }

  const handleDelete = async (id: number) => {
    await clipboardService.clipDelete(id)
    await refresh()
  }

  const handleClear = async () => {
    await clipboardService.clipClear()
    await refresh()
  }

  // 多选切换
  const handleSelectToggle = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectionMode = () => {
    setIsSelectionMode(prev => !prev)
    if (isSelectionMode) setSelectedIds(new Set())
  }

  // 批量合并复制
  const handleBatchCopy = async () => {
    if (selectedIds.size === 0) return
    // 按在当前列表中显示的顺序拼接（这也就是它们在视图中的顺序）
    const selectedClips = clips.filter(c => selectedIds.has(c.id))
    const texts = selectedClips.map(c => c.text_content || c.ocr_text || '').filter(Boolean)
    if (texts.length === 0) {
      showToast('选中的内容不包含有效文本', 'info')
      return
    }
    const merged = texts.join('\n\n')
    try {
      await navigator.clipboard.writeText(merged)
      showToast(`已合并且复制了 ${selectedClips.length} 项记录`, 'success')
      setIsSelectionMode(false)
      setSelectedIds(new Set())
    } catch (err) {
      showToast('合并复制失败', 'error')
    }
  }

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)
    for (const id of ids) {
      await clipboardService.clipDelete(id)
    }
    showToast(`已删除 ${ids.length} 项记录`, 'success')
    setIsSelectionMode(false)
    setSelectedIds(new Set())
    await refresh()
  }

  const selectedItems = useMemo(() => clips.filter(c => selectedIds.has(c.id)), [clips, selectedIds])
  // Diff 要求正好选了2项，并且这两项都是纯文本或代码
  const canDiff = selectedItems.length === 2 && selectedItems.every(c => c.content_type === 'text' || c.content_type === 'code')

  const filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'text', label: '文本' },
    { key: 'code', label: '代码' },
    { key: 'image', label: '图片' },
    { key: 'pinned', label: '已置顶' },
  ]

  return (
    <div className="flex flex-col h-full animate-fade-in w-full max-w-4xl mx-auto overflow-y-auto overflow-x-hidden pb-10 relative">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-6 mb-8 mt-2 sticky top-0 z-10 bg-surface/80 backdrop-blur-xl py-4 -mx-2 px-2 border-b border-surface-container-highest">
        
        {/* 顶部搜索 */}
        <div className="w-full md:flex-1 md:max-w-md relative group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="搜索剪贴板内容..."
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            className="w-full h-11 bg-surface-container-low pl-10 pr-4 rounded-full text-sm placeholder:text-on-surface-variant/70 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
          />
        </div>

        {/* 过滤器 */}
        <div className="flex flex-wrap items-center gap-2">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                activeFilter === f.key
                  ? "bg-surface-container-highest text-on-surface"
                  : "text-on-surface-variant hover:bg-surface-container-low"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* 全局操作 */}
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={toggleSelectionMode}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-colors",
              isSelectionMode ? "bg-primary text-white" : "bg-surface-container text-on-surface-variant hover:text-on-surface"
            )}
          >
            <ListChecks className="w-4 h-4" />
            {isSelectionMode ? '取消多选' : '多选'}
          </button>

          <button
            onClick={() => toggleWatch(!watching)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-colors",
              watching
                ? "bg-green-500/10 text-green-600"
                : "bg-surface-container-highest text-on-surface-variant hover:text-on-surface"
            )}
            title={watching ? "点击关闭监听" : "点击开启监听"}
          >
            {watching && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
            {watching ? '监听中' : '未监听'}
          </button>
          
          <button onClick={handleClear} className="text-sm font-medium text-on-surface-variant hover:text-red-500 hover:bg-red-500/10 px-4 py-2 rounded-full transition-colors">
            清空未置顶
          </button>
        </div>
      </div>

      {loading && <div className="text-center text-on-surface-variant py-12">加载中...</div>}

      <div className={cn("flex-1 overflow-y-auto flex flex-col gap-6", isSelectionMode ? "pb-32" : "pb-20")}>
        {clips.map(clip => (
          <ClipCard 
            key={clip.id} 
            clip={clip} 
            onPin={handlePin} 
            onCopy={handleCopy} 
            onDelete={handleDelete}
            selectable={isSelectionMode}
            selected={selectedIds.has(clip.id)}
            onSelectToggle={handleSelectToggle}
          />
        ))}

        {!loading && clips.length === 0 && (
          <div className="text-center text-on-surface-variant py-20 flex flex-col items-center gap-2 mt-10">
            <ClipboardItemPlaceholder />
            <p className="text-lg font-bold mt-4 text-on-surface">剪贴板为空</p>
            <p className="text-sm font-medium text-on-surface-variant/70">复制的内容会自动记录在这里</p>
          </div>
        )}
      </div>

      {/* 悬浮操作台 (Floating Action Bar) */}
      {isSelectionMode && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-40 animate-slide-up">
          <div className="bg-surface/90 backdrop-blur-md border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.5)] rounded-2xl px-6 py-4 flex items-center gap-6">
            <div className="flex items-center gap-2 text-sm font-bold text-on-surface shrink-0">
              <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs">
                {selectedIds.size}
              </span>
              已选
            </div>

            <div className="w-[1px] h-6 bg-white/10" />

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleBatchCopy}
                disabled={selectedIds.size === 0}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
              >
                <Copy className="w-4 h-4" />
                合并复制
              </button>

              <button
                onClick={() => setShowDiff(true)}
                disabled={!canDiff}
                title={canDiff ? "对比两天记录差异" : "仅支持对比刚好2条文本/代码记录"}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 rounded-xl text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ArrowRightLeft className="w-4 h-4" />
                差异对比
              </button>

              <button
                onClick={handleBatchDelete}
                disabled={selectedIds.size === 0}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-xl text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                批量删除
              </button>
            </div>
            
            <button
              onClick={toggleSelectionMode}
              className="ml-2 p-2 hover:bg-surface-container rounded-lg text-on-surface-variant transition-colors group relative"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Diff 弹窗 */}
      {showDiff && selectedItems.length === 2 && (
        <ClipDiffModal
          itemA={selectedItems[0]}
          itemB={selectedItems[1]}
          onClose={() => setShowDiff(false)}
        />
      )}
    </div>
  )
}

function ClipboardItemPlaceholder() {
  return (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-on-surface-variant/20">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
    </svg>
  )
}
