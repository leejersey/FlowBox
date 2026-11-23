/**
 * ClipboardPickerPage — 全局剪贴板快选浮窗（⇧⌘V）
 *
 * 由独立无边框透明窗口承载：搜索 + ↑↓ 选择 + Enter 立即写回系统剪贴板并隐藏
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { Search, Pin, Code2, Type, Image as ImageIcon, CornerDownLeft, X } from 'lucide-react'
import * as clipboardService from '@/services/clipboardService'
import type { ClipboardItem } from '@/types/clipboard'
import { cn } from '@/lib/utils'
import { playCopySuccessSound } from '@/lib/soundEffects'

const isTauriApp = isTauri()

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

export function ClipboardPickerPage() {
  const [clips, setClips] = useState<ClipboardItem[]>([])
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const hidePicker = useCallback(() => {
    if (isTauriApp) {
      invoke('hide_clipboard_picker').catch(() => {})
    }
  }, [])

  const loadClips = useCallback(async () => {
    if (!isTauriApp) return
    try {
      const list = await clipboardService.clipList({ limit: 50 })
      setClips(list)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadClips()
      inputRef.current?.focus()
    }, 0)
    const handleFocus = () => {
      setQuery('')
      setSelectedIdx(0)
      void loadClips()
      window.setTimeout(() => inputRef.current?.focus(), 40)
    }
    const handleBlur = () => {
      if (!isTauriApp) return
      window.setTimeout(() => {
        if (!document.hasFocus()) hidePicker()
      }, 150)
    }
    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
    }
  }, [hidePicker, loadClips])

  const filtered = useMemo(() => {
    const kw = query.trim().toLowerCase()
    if (!kw) return clips
    return clips.filter(item =>
      (item.text_content?.toLowerCase().includes(kw) ?? false) ||
      (item.ocr_text?.toLowerCase().includes(kw) ?? false) ||
      (item.category?.toLowerCase().includes(kw) ?? false),
    )
  }, [clips, query])

  const activeIdx = Math.min(selectedIdx, Math.max(0, filtered.length - 1))

  useEffect(() => {
    itemRefs.current[activeIdx]?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  const handleSelectClip = useCallback(async (clip: ClipboardItem) => {
    const text = clip.text_content || clip.ocr_text || ''
    try {
      if (text) {
        if (isTauriApp) {
          await invoke('clipboard_write_text', { text })
        } else {
          await navigator.clipboard.writeText(text)
        }
        playCopySuccessSound()
      }
    } catch {
      // 兜底浏览器剪贴板 API
      if (text) await navigator.clipboard.writeText(text).catch(() => {})
    }
    hidePicker()
  }, [hidePicker])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        hidePicker()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIdx(i => Math.min(i + 1, Math.max(0, filtered.length - 1)))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIdx(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && filtered[activeIdx]) {
        e.preventDefault()
        void handleSelectClip(filtered[activeIdx])
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeIdx, filtered, handleSelectClip, hidePicker])

  return (
    <div
      className="w-full h-full flex items-start justify-center p-3 select-none"
      style={{ background: 'transparent' }}
    >
      <div className="w-full h-full bg-surface/95 backdrop-blur-3xl border border-outline-variant/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* 顶部搜索栏 */}
        <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-outline-variant/20 bg-surface-container-low/50 shrink-0">
          <Search className="w-4 h-4 text-primary shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              setSelectedIdx(0)
            }}
            placeholder="搜索剪贴板历史，回车立即复制到剪贴板..."
            className="flex-1 bg-transparent text-sm font-medium text-on-surface placeholder:text-on-surface-variant/45 outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="px-1.5 py-0.5 rounded bg-surface-container text-[10px] font-mono text-on-surface-variant border border-outline-variant/30">
            ESC
          </kbd>
        </div>

        {/* 剪贴历史列表 */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {filtered.length > 0 ? (
            filtered.map((clip, idx) => {
              const isSelected = idx === activeIdx
              const preview = clip.content_type === 'image'
                ? (clip.ocr_text ? `[图片 OCR] ${clip.ocr_text}` : '[剪贴板图片]')
                : (clip.text_content || '').replace(/\s+/g, ' ').trim()

              return (
                <button
                  type="button"
                  key={clip.id}
                  ref={el => { itemRefs.current[idx] = el }}
                  onClick={() => void handleSelectClip(clip)}
                  onMouseEnter={() => setSelectedIdx(idx)}
                  className={cn(
                    'w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-2xl text-left transition-all cursor-pointer',
                    isSelected
                      ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                      : 'text-on-surface hover:bg-surface-container',
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className={cn(
                      'w-7 h-7 rounded-xl flex items-center justify-center shrink-0',
                      isSelected ? 'bg-primary text-white' : 'bg-surface-container-highest text-on-surface-variant',
                    )}>
                      {clip.content_type === 'code' ? (
                        <Code2 className="w-3.5 h-3.5" />
                      ) : clip.content_type === 'image' ? (
                        <ImageIcon className="w-3.5 h-3.5" />
                      ) : (
                        <Type className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={cn(
                        'text-xs truncate',
                        clip.content_type === 'code' ? 'font-mono' : 'font-medium',
                        isSelected ? 'text-primary font-semibold' : 'text-on-surface',
                      )}>
                        {preview || '(空内容)'}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-on-surface-variant/70 mt-0.5">
                        <span>{timeAgo(clip.created_at)}</span>
                        {clip.category && <span className="text-primary font-semibold">{clip.category}</span>}
                        {clip.is_pinned === 1 && (
                          <span className="inline-flex items-center gap-0.5 text-amber-500 font-semibold">
                            <Pin className="w-2.5 h-2.5" /> 已置顶
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isSelected && <CornerDownLeft className="w-3.5 h-3.5 shrink-0 opacity-80" />}
                </button>
              )
            })
          ) : (
            <div className="py-16 text-center text-xs text-on-surface-variant/60">
              {query ? '未找到匹配的剪贴板记录' : '暂无剪贴板历史'}
            </div>
          )}
        </div>

        {/* 底部快捷键指引 */}
        <div className="px-4 py-2 border-t border-outline-variant/15 bg-surface-container-low/40 flex items-center justify-between text-[10px] text-on-surface-variant/70 shrink-0">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1 py-0.5 rounded bg-surface-container font-mono border border-outline-variant/30">↑↓</kbd> 导航</span>
            <span><kbd className="px-1 py-0.5 rounded bg-surface-container font-mono border border-outline-variant/30">↵</kbd> 复制回填</span>
          </div>
          <span>⇧⌘V 全局剪贴板快选</span>
        </div>
      </div>
    </div>
  )
}
