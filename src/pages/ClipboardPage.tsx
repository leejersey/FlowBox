import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Search, Pin, Copy, Trash2, Clock, Code2, Type,
  Image as ImageIcon, ListChecks, CheckSquare, Square,
  ArrowRightLeft, X, Sparkles, Activity, ShieldCheck, Link2,
  Bot
} from 'lucide-react'
import { convertFileSrc, isTauri } from '@tauri-apps/api/core'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { cn } from '@/lib/utils'
import * as clipboardService from '@/services/clipboardService'
import { todoCreate } from '@/services/todoService'
import { showToast } from '@/store/useToastStore'
import type { ClipboardItem } from '@/types/clipboard'
import { useClipboardControls } from '@/hooks/useClipboardWatcher'
import { useDebounce } from '@/hooks/useDebounce'
import { ClipDiffModal } from '@/components/clipboard/ClipDiffModal'
import { ClipDetailPanel } from '@/components/clipboard/ClipDetailPanel'
import { ResizablePanel } from '@/components/ui/ResizablePanel'
import { ContextMenu, type ContextMenuItem } from '@/components/ui/ContextMenu'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ImageLightbox } from '@/components/ui/ImageLightbox'
import { LinkPanel } from '@/components/links/LinkPanel'
import { ensureLinkedTarget, linkedTargetFor, linkedTargetId } from '@/lib/itemLink'
import { playCopySuccessSound } from '@/lib/soundEffects'

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
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

type FilterKey = 'all' | 'text' | 'code' | 'image' | 'pinned'

// 紧凑型左侧 Master 卡片
function ClipCard({
  clip,
  isSelected,
  onCardClick,
  selectable,
  checked,
  onCheckToggle,
  onLink,
  onPin,
  onCopy,
  onDelete,
  onContextMenu,
}: {
  clip: ClipboardItem
  isSelected?: boolean
  onCardClick: (clip: ClipboardItem) => void
  selectable?: boolean
  checked?: boolean
  onCheckToggle?: (id: number) => void
  onLink?: (id: number) => void
  onPin: (id: number) => void
  onCopy: (clip: ClipboardItem) => void
  onDelete: (id: number) => void
  onContextMenu?: (e: React.MouseEvent, clip: ClipboardItem) => void
}) {
  const [imageFallback, setImageFallback] = useState<{ path: string; src: string } | null>(null)
  const imageSrc = imageFallback?.path === clip.image_path
    ? imageFallback.src
    : resolveImageSrc(clip.image_path)

  const handleClick = () => {
    if (selectable && onCheckToggle) {
      onCheckToggle(clip.id)
    } else {
      onCardClick(clip)
    }
  }

  return (
    <div
      id={`clipboard-${clip.id}`}
      onClick={handleClick}
      onContextMenu={(e) => onContextMenu?.(e, clip)}
      className={cn(
        "group relative flex flex-col p-3.5 rounded-2xl transition-all duration-200 border cursor-pointer select-none",
        isSelected
          ? "border-primary/50 bg-primary/10 shadow-md ring-1 ring-primary/30"
          : "bg-surface-container hover:bg-surface-container-highest border-outline-variant/20 hover:border-outline-variant/40 shadow-xs"
      )}
    >
      {/* 置顶指示器 */}
      {clip.is_pinned === 1 && !selectable && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-md shadow-xs" />
      )}

      <div className="flex items-start gap-2.5">
        {selectable && (
          <div className="mt-0.5 shrink-0 transition-colors">
            {checked ? (
              <CheckSquare className="w-4 h-4 text-primary" />
            ) : (
              <Square className="w-4 h-4 text-on-surface-variant/40 group-hover:text-on-surface-variant" />
            )}
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* 内容预览 */}
          {clip.content_type === 'text' && (
            <p className="text-xs leading-relaxed text-on-surface line-clamp-2 font-normal">
              {clip.text_content}
            </p>
          )}

          {clip.content_type === 'code' && (
            <div className="bg-surface-container-highest/60 px-2.5 py-1.5 rounded-lg border border-outline-variant/20 text-[11px] font-mono text-on-surface truncate">
              {clip.text_content?.split('\n')[0] || '代码片段'}
            </div>
          )}

          {clip.content_type === 'image' && (
            <div className="flex items-center gap-2.5">
              {imageSrc ? (
                <img
                  src={imageSrc}
                  alt="预览"
                  className="w-12 h-12 object-cover rounded-lg border border-outline-variant/30 shrink-0 bg-surface-container-highest"
                  onError={() => {
                    if (!clip.image_path) return
                    const fileFallback = `file://${encodeURI(clip.image_path)}`
                    if (imageSrc !== fileFallback) {
                      setImageFallback({ path: clip.image_path, src: fileFallback })
                    }
                  }}
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-surface-container-highest flex items-center justify-center shrink-0 border border-outline-variant/20">
                  <ImageIcon className="w-5 h-5 text-on-surface-variant/40" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <span className="text-xs text-on-surface-variant font-medium">图片记录</span>
                {clip.ocr_text && (
                  <p className="text-[10px] text-primary truncate font-mono mt-0.5">
                    OCR: {clip.ocr_text}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 底部微信息与操作 */}
          <div className="flex items-center justify-between mt-2.5 pt-1.5 border-t border-outline-variant/10 text-[10px] text-on-surface-variant">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 font-medium">
                <Clock className="w-3 h-3" />
                {timeAgo(clip.created_at)}
              </span>

              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-surface-container-highest/80 font-medium">
                {clip.content_type === 'text' && <Type className="w-2.5 h-2.5" />}
                {clip.content_type === 'code' && <Code2 className="w-2.5 h-2.5" />}
                {clip.content_type === 'image' && <ImageIcon className="w-2.5 h-2.5" />}
                <span>{clip.content_type === 'text' ? '文本' : clip.content_type === 'code' ? '代码' : '图片'}</span>
              </span>

              {clip.category && (
                <span className="px-1.5 py-0.5 rounded font-bold bg-primary/10 text-primary">
                  {clip.category}
                </span>
              )}
            </div>

            {/* 快速悬浮操作 */}
            {!selectable && (
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {onLink && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onLink(clip.id) }}
                    className="p-1 hover:bg-surface-container-highest rounded text-on-surface-variant hover:text-primary cursor-pointer"
                    title="关联知识"
                  >
                    <Link2 className="w-3 h-3" />
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onCopy(clip) }}
                  className="p-1 hover:bg-surface-container-highest rounded text-on-surface-variant hover:text-on-surface cursor-pointer"
                  title="复制"
                >
                  <Copy className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onPin(clip.id) }}
                  className="p-1 hover:bg-surface-container-highest rounded text-on-surface-variant hover:text-on-surface cursor-pointer"
                  title="置顶"
                >
                  <Pin className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(clip.id) }}
                  className="p-1 hover:bg-red-500/10 hover:text-red-500 rounded text-on-surface-variant cursor-pointer"
                  title="删除"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function ClipboardPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [clips, setClips] = useState<ClipboardItem[]>([])
  const [linkedClip, setLinkedClip] = useState<ClipboardItem | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')
  const [keyword, setKeyword] = useState('')
  const [selectedClip, setSelectedClip] = useState<ClipboardItem | null>(null)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [linkId, setLinkId] = useState<number | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; clip: ClipboardItem } | null>(null)

  const highlight = searchParams.get('highlight')
  const highlightId = linkedTargetId(highlight, 'clipboard')
  const currentLinkedClip = linkedTargetFor(highlightId, linkedClip)
  const visibleClips = useMemo(
    () => currentLinkedClip && !clips.some(clip => clip.id === currentLinkedClip.id) ? [...clips, currentLinkedClip] : clips,
    [clips, currentLinkedClip],
  )
  const visibleSelectedClip = highlightId ? linkedTargetFor(highlightId, selectedClip) : selectedClip

  // 搜索防抖
  const debouncedKeyword = useDebounce(keyword, 250)

  // 多选与对比模式状态
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
      if (debouncedKeyword.trim()) params.keyword = debouncedKeyword.trim()
      const list = await clipboardService.clipList(params)
      setClips(list)
    } finally {
      setLoading(false)
    }
  }, [activeFilter, debouncedKeyword])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    if (loading || !highlightId) return
    let cancelled = false
    void ensureLinkedTarget(visibleClips, highlightId, clipboardService.clipGet).then(({ target }) => {
      if (!cancelled && !visibleClips.includes(target)) setLinkedClip(target)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [highlightId, loading, visibleClips])

  useEffect(() => {
    if (loading || !highlightId || !highlight) return
    const clip = visibleClips.find(item => item.id === highlightId)
    const target = document.getElementById(highlight)
    if (!clip || !target) return
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    target.classList.add('ring-2', 'ring-primary')
    const selectionTimer = window.setTimeout(() => setSelectedClip(clip), 0)
    const timer = window.setTimeout(() => target.classList.remove('ring-2', 'ring-primary'), 1800)
    return () => {
      window.clearTimeout(selectionTimer)
      window.clearTimeout(timer)
    }
  }, [highlight, highlightId, loading, visibleClips])

  // 剪贴板监听
  const { watching, toggleWatch } = useClipboardControls(refresh)

  const handleCopy = async (clip: ClipboardItem) => {
    if (clip.text_content) {
      try {
        await navigator.clipboard.writeText(clip.text_content)
        playCopySuccessSound()
        showToast('已复制到剪贴板', 'success')
      } catch {
        showToast('复制失败', 'error')
      }
    }
  }

  const handlePin = async (id: number) => {
    await clipboardService.clipTogglePin(id)
    await refresh()
    if (selectedClip?.id === id) {
      setSelectedClip(prev => prev ? { ...prev, is_pinned: prev.is_pinned === 1 ? 0 : 1 } : null)
    }
  }

  const handleDelete = async (id: number) => {
    await clipboardService.clipDelete(id)
    if (selectedClip?.id === id) {
      setSelectedClip(null)
    }
    await refresh()
  }

  const handleClear = async () => {
    await clipboardService.clipClear()
    setSelectedClip(null)
    await refresh()
  }

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement
      const isInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA' || activeEl?.getAttribute('contenteditable') === 'true'
      if (isInput) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (visibleClips.length === 0) return
        if (!selectedClip) {
          setSelectedClip(visibleClips[0])
        } else {
          const currentIndex = visibleClips.findIndex(c => c.id === selectedClip.id)
          if (currentIndex < visibleClips.length - 1) {
            setSelectedClip(visibleClips[currentIndex + 1])
          }
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (visibleClips.length === 0) return
        if (!selectedClip) {
          setSelectedClip(visibleClips[visibleClips.length - 1])
        } else {
          const currentIndex = visibleClips.findIndex(c => c.id === selectedClip.id)
          if (currentIndex > 0) {
            setSelectedClip(visibleClips[currentIndex - 1])
          }
        }
      } else if (e.key === 'Escape') {
        if (selectedClip) {
          setSelectedClip(null)
        } else if (isSelectionMode) {
          setIsSelectionMode(false)
          setSelectedIds(new Set())
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [visibleClips, selectedClip, isSelectionMode])

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
    } catch {
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
    if (selectedClip && ids.includes(selectedClip.id)) setSelectedClip(null)
    await refresh()
  }

  const selectedItems = useMemo(() => clips.filter(c => selectedIds.has(c.id)), [clips, selectedIds])
  const canDiff = selectedItems.length === 2 && selectedItems.every(c => c.content_type === 'text' || c.content_type === 'code')

  const filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'text', label: '文本' },
    { key: 'code', label: '代码' },
    { key: 'image', label: '图片' },
    { key: 'pinned', label: '已置顶' },
  ]

  // 统计指标
  const textCount = useMemo(() => clips.filter(c => c.content_type === 'text').length, [clips])
  const codeCount = useMemo(() => clips.filter(c => c.content_type === 'code').length, [clips])
  const imageCount = useMemo(() => clips.filter(c => c.content_type === 'image').length, [clips])
  const pinnedCount = useMemo(() => clips.filter(c => c.is_pinned === 1).length, [clips])

  const activeClipForPanel = visibleSelectedClip

  // 右键菜单项生成
  const contextMenuItems = useMemo((): ContextMenuItem[] => {
    if (!contextMenu) return []
    const { clip } = contextMenu
    const isPinned = clip.is_pinned === 1

    return [
      {
        key: 'copy',
        label: '立即复制文本',
        icon: Copy,
        shortcut: '⌘C',
        onClick: () => handleCopy(clip),
      },
      {
        key: 'to_todo',
        label: '一键转化为待办任务',
        icon: CheckSquare,
        shortcut: 'T',
        onClick: async () => {
          try {
            const rawText = clip.text_content || clip.ocr_text || '剪贴板任务'
            const title = rawText.split('\n')[0].trim().slice(0, 60) || '剪贴板任务'
            const newTodo = await todoCreate({
              title,
              content: rawText.length > title.length ? rawText : '',
              priority: 1,
              source: 'clipboard',
              source_id: clip.id,
              tags: clip.category ? [clip.category] : ['剪贴板'],
            })
            showToast('已成功转化为待办任务！', 'success')
            navigate(`/?highlight=todo-${newTodo.id}`)
          } catch (err) {
            showToast(`转化失败: ${String(err)}`, 'error')
          }
        }
      },
      {
        key: 'pin',
        label: isPinned ? '取消置顶' : '置顶此条目',
        icon: Pin,
        onClick: () => handlePin(clip.id),
      },
      ...(clip.ocr_text ? [{
        key: 'copy_ocr',
        label: '复制 OCR 识别文字',
        icon: Bot,
        onClick: async () => {
          await navigator.clipboard.writeText(clip.ocr_text!)
          showToast('OCR 文本已复制', 'success')
        }
      }] : []),
      {
        key: 'link',
        label: '关联知识与文档',
        icon: Link2,
        onClick: () => setLinkId(clip.id),
      },
      { key: 'sep', label: '', separator: true },
      {
        key: 'delete',
        label: '删除此记录',
        icon: Trash2,
        shortcut: '⌫',
        danger: true,
        onClick: () => handleDelete(clip.id),
      }
    ]
  }, [contextMenu, navigate])

  return (
    <div className="flex flex-col lg:flex-row h-full gap-6 w-full min-w-0 overflow-hidden animate-fade-in">
      
      {/* ── 左栏 Master：支持拖拽调宽的剪贴板紧凑流 ── */}
      <ResizablePanel
        id="clipboard"
        defaultWidth={390}
        minWidth={280}
        maxWidth={560}
        className={cn(
          "transition-all duration-300",
          activeClipForPanel ? "hidden lg:flex" : "flex"
        )}
      >
        {/* 顶部搜索与过滤 */}
        <div className="flex flex-col gap-3 pb-4 border-b border-outline-variant/15 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                placeholder="搜索剪贴板或 OCR 文本..."
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                className="w-full h-10 bg-surface-container-low pl-9 pr-3 rounded-xl text-xs placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium border border-outline-variant/20"
              />
            </div>

            {/* 监听状态胶囊按钮 */}
            <button
              onClick={() => toggleWatch(!watching)}
              className={cn(
                "flex items-center gap-1.5 px-3 h-10 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 border",
                watching
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 shadow-xs"
                  : "bg-surface-container-low text-on-surface-variant hover:text-on-surface border-outline-variant/20"
              )}
              title={watching ? "点击暂停监听" : "点击启动监听"}
            >
              {watching && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
              <span>{watching ? '监听中' : '未监听'}</span>
            </button>
          </div>

          {/* 分类标签与功能按钮行 */}
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
              {filters.map(f => (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap",
                    activeFilter === f.key
                      ? "bg-primary/15 text-primary font-bold shadow-xs border border-primary/20"
                      : "text-on-surface-variant/80 hover:text-on-surface hover:bg-surface-container-low"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={toggleSelectionMode}
                className={cn(
                  "p-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer",
                  isSelectionMode ? "bg-primary text-white" : "text-on-surface-variant hover:bg-surface-container-low"
                )}
                title={isSelectionMode ? "退出多选" : "多选管理"}
              >
                <ListChecks className="w-4 h-4" />
              </button>

              <button
                onClick={handleClear}
                className="text-[11px] font-medium text-on-surface-variant/70 hover:text-red-500 hover:bg-red-500/10 px-2 py-1 rounded-md transition-colors cursor-pointer"
                title="清空所有未置顶条目"
              >
                清空
              </button>
            </div>
          </div>
        </div>

        {/* 骨架加载态 */}
        {loading && (
          <div className="flex flex-col gap-3 py-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {/* 卡片流 */}
        {!loading && (
          visibleClips.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-4">
              <EmptyState
                icon={<Search className="w-8 h-8 text-primary" />}
                title="剪贴板暂无数据"
                description="复制的任何文本、代码或截图都会自动安全存入 FlowBox"
              />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto pt-3 pb-8 space-y-3 no-scrollbar">
              {visibleClips.map(clip => (
                <ClipCard
                  key={clip.id}
                  clip={clip}
                  isSelected={activeClipForPanel?.id === clip.id}
                  onCardClick={setSelectedClip}
                  selectable={isSelectionMode}
                  checked={selectedIds.has(clip.id)}
                  onCheckToggle={handleSelectToggle}
                  onLink={setLinkId}
                  onPin={handlePin}
                  onCopy={handleCopy}
                  onDelete={handleDelete}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setContextMenu({ x: e.clientX, y: e.clientY, clip })
                  }}
                />
              ))}
            </div>
          )
        )}
      </ResizablePanel>

      {/* ── 右栏 Detail：深度工作台 / 剪贴板看板 ── */}
      <div className={cn(
        "flex-1 h-full min-w-0 flex-col overflow-hidden transition-all duration-300",
        activeClipForPanel ? "flex" : "hidden lg:flex"
      )}>
        {activeClipForPanel ? (
          <ClipDetailPanel
            clip={activeClipForPanel}
            onClose={() => setSelectedClip(null)}
            onPin={handlePin}
            onDelete={handleDelete}
            onCopy={handleCopy}
            onImageClick={src => setLightboxSrc(src)}
          />
        ) : (
          /* 未选中任何剪贴板条目时的看板 */
          <div className="h-full flex flex-col justify-between p-8 bg-surface-container/30 border border-outline-variant/20 rounded-3xl backdrop-blur-xl animate-fade-in select-none">
            {/* 顶栏信息 */}
            <div>
              <div className="flex items-center gap-2.5 text-primary mb-2">
                <Sparkles className="w-5 h-5" />
                <span className="text-xs font-bold tracking-wider uppercase">剪贴板深度捕获与沉淀</span>
              </div>
              <h2 className="text-2xl font-display font-bold text-on-surface">选择任意记录查看或转为待办</h2>
              <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed max-w-md">
                使用鼠标点击或按 <kbd className="px-1 py-0.5 rounded bg-surface-container border border-outline-variant/30 font-mono text-[10px]">↑</kbd> <kbd className="px-1 py-0.5 rounded bg-surface-container border border-outline-variant/30 font-mono text-[10px]">↓</kbd> 切换记录，右键卡片唤起快捷菜单。
              </p>
            </div>

            {/* 统计指标卡片 */}
            <div className="grid grid-cols-4 gap-3.5 my-6">
              <div className="bg-surface-container/60 p-4 rounded-2xl border border-outline-variant/20">
                <div className="text-[11px] font-bold text-on-surface-variant mb-1 flex items-center gap-1">
                  <Type className="w-3 h-3 text-primary" /> 文本
                </div>
                <div className="text-2xl font-display font-bold text-on-surface">{textCount}</div>
              </div>
              <div className="bg-surface-container/60 p-4 rounded-2xl border border-outline-variant/20">
                <div className="text-[11px] font-bold text-on-surface-variant mb-1 flex items-center gap-1">
                  <Code2 className="w-3 h-3 text-violet-500" /> 代码
                </div>
                <div className="text-2xl font-display font-bold text-violet-500">{codeCount}</div>
              </div>
              <div className="bg-surface-container/60 p-4 rounded-2xl border border-outline-variant/20">
                <div className="text-[11px] font-bold text-on-surface-variant mb-1 flex items-center gap-1">
                  <ImageIcon className="w-3 h-3 text-blue-500" /> 图片
                </div>
                <div className="text-2xl font-display font-bold text-blue-500">{imageCount}</div>
              </div>
              <div className="bg-surface-container/60 p-4 rounded-2xl border border-outline-variant/20">
                <div className="text-[11px] font-bold text-on-surface-variant mb-1 flex items-center gap-1">
                  <Pin className="w-3 h-3 text-amber-500" /> 已置顶
                </div>
                <div className="text-2xl font-display font-bold text-amber-500">{pinnedCount}</div>
              </div>
            </div>

            {/* 监听与提效状态栏 */}
            <div className="bg-surface-container-low/80 p-4 rounded-2xl border border-outline-variant/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                <div className="text-xs">
                  <span className="font-bold text-on-surface">本地隐私保护：</span>
                  <span className="text-on-surface-variant ml-1">所有剪贴板文本与图片均保存在本地 SQLite，绝不上云</span>
                </div>
              </div>
              <button
                onClick={() => toggleWatch(!watching)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-surface-container text-on-surface hover:bg-surface-container-highest transition-colors cursor-pointer"
              >
                <Activity className="w-3.5 h-3.5 text-primary" />
                <span>{watching ? '监听运行中' : '开启监听'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 悬浮操作条 (多选模式) */}
      {isSelectionMode && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 animate-slide-up">
          <div className="bg-surface/95 backdrop-blur-xl border border-outline-variant/50 shadow-2xl rounded-2xl px-6 py-3.5 flex items-center gap-5">
            <div className="flex items-center gap-2 text-xs font-bold text-on-surface shrink-0">
              <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px]">
                {selectedIds.size}
              </span>
              已选
            </div>

            <div className="w-[1px] h-5 bg-outline-variant/30" />

            <div className="flex items-center gap-2">
              <button
                onClick={handleBatchCopy}
                disabled={selectedIds.size === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-xl text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-colors shadow-xs cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                合并复制
              </button>

              <button
                onClick={() => setShowDiff(true)}
                disabled={!canDiff}
                title={canDiff ? "对比两条记录差异" : "仅支持对比刚好 2 条文本/代码记录"}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 rounded-xl text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                差异对比
              </button>

              <button
                onClick={handleBatchDelete}
                disabled={selectedIds.size === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 rounded-xl text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                批量删除
              </button>
            </div>
            
            <button
              onClick={toggleSelectionMode}
              className="p-1 hover:bg-surface-container rounded-lg text-on-surface-variant transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
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

      {/* 图片灯箱 */}
      <ImageLightbox
        src={lightboxSrc}
        onClose={() => setLightboxSrc(null)}
      />
      {linkId !== null && <LinkPanel type="clipboard" id={linkId} onClose={() => setLinkId(null)} />}

      {/* 右键上下文菜单 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
