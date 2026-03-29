import { useState, useEffect, useCallback } from 'react'
import { Search, Pin, Copy, Bot, Trash2, Clock, Code2, Type, Image as ImageIcon } from 'lucide-react'
import { convertFileSrc, isTauri } from '@tauri-apps/api/core'
import { cn } from '@/lib/utils'
import * as clipboardService from '@/services/clipboardService'
import type { ClipboardItem } from '@/types/clipboard'
import { useClipboardWatcher } from '@/hooks/useClipboardWatcher'

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

function ClipCard({ clip, onPin, onCopy, onDelete }: {
  clip: ClipboardItem
  onPin: (id: number) => void
  onCopy: (clip: ClipboardItem) => void
  onDelete: (id: number) => void
}) {
  const [imageSrc, setImageSrc] = useState<string | null>(resolveImageSrc(clip.image_path))

  useEffect(() => {
    setImageSrc(resolveImageSrc(clip.image_path))
  }, [clip.image_path])

  return (
    <div className="group relative bg-surface-container hover:bg-surface-container-highest transition-all duration-300 rounded-[24px] p-6 flex flex-col shadow-sm cursor-pointer border border-transparent hover:border-white/20">
      {clip.is_pinned === 1 && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-primary rounded-r-md" />
      )}

      <div className="mb-4">
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

      <div className="flex items-center justify-between mt-auto">
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

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0 duration-200">
          <button onClick={() => onCopy(clip)} className="p-2 hover:bg-surface-container-highest rounded-lg text-on-surface-variant hover:text-on-surface transition-colors" title="复制">
            <Copy className="w-4 h-4" />
          </button>
          <button onClick={() => onPin(clip.id)} className="p-2 hover:bg-surface-container-highest rounded-lg text-on-surface-variant hover:text-on-surface transition-colors" title="置顶">
            <Pin className="w-4 h-4" />
          </button>
          <button onClick={() => onDelete(clip.id)} className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-lg text-on-surface-variant transition-colors" title="删除">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function ClipboardPage() {
  const [clips, setClips] = useState<ClipboardItem[]>([])
  const [loading, setLoading] = useState(false)
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')
  const [keyword, setKeyword] = useState('')

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
      await navigator.clipboard.writeText(clip.text_content)
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

  const filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'text', label: '文本' },
    { key: 'code', label: '代码' },
    { key: 'image', label: '图片' },
    { key: 'pinned', label: '已置顶' },
  ]

  return (
    <div className="flex flex-col h-full animate-fade-in w-full max-w-4xl mx-auto overflow-y-auto overflow-x-hidden pb-10">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-6 mb-8 mt-2 sticky top-0 z-10 bg-surface/80 backdrop-blur-xl py-4 -mx-2 px-2">
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

        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={() => toggleWatch(!watching)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-colors",
              watching
                ? "bg-green-500/10 text-green-600"
                : "bg-surface-container-highest text-on-surface-variant hover:text-on-surface"
            )}
          >
            {watching && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
            {watching ? '监听中' : '未监听'}
          </button>
          <button onClick={handleClear} className="text-sm font-medium text-on-surface-variant hover:text-red-500 hover:bg-red-500/10 px-4 py-2 rounded-full transition-colors">
            清除历史
          </button>
        </div>
      </div>

      {loading && <div className="text-center text-on-surface-variant py-12">加载中...</div>}

      <div className="flex-1 overflow-y-auto pb-20 flex flex-col gap-6">
        {clips.map(clip => (
          <ClipCard key={clip.id} clip={clip} onPin={handlePin} onCopy={handleCopy} onDelete={handleDelete} />
        ))}
      </div>

      {!loading && clips.length === 0 && (
        <div className="text-center text-on-surface-variant py-20">
          <p className="text-lg mb-2">📋 剪贴板为空</p>
          <p className="text-sm">复制内容后会自动记录在这里</p>
        </div>
      )}
    </div>
  )
}
