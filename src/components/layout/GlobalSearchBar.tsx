/**
 * GlobalSearchBar — 跨模块全局搜索浮层
 *
 * 快捷键 Cmd+/ 或点击 Sidebar 搜索图标触发
 * 毛玻璃浮层，实时搜索，结果分组展示
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X, CheckSquare, Lightbulb, Mic, Clipboard, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { globalSearch, type SearchResult, type SearchResultType } from '@/services/searchService'
import { cn } from '@/lib/utils'

const typeConfig: Record<SearchResultType, { icon: typeof Search; label: string; color: string; path: string }> = {
  todo: { icon: CheckSquare, label: '待办', color: 'text-blue-500 bg-blue-500/10', path: '/' },
  idea: { icon: Lightbulb, label: '灵感', color: 'text-amber-500 bg-amber-500/10', path: '/idea' },
  voice: { icon: Mic, label: '语音', color: 'text-rose-500 bg-rose-500/10', path: '/voice' },
  clipboard: { icon: Clipboard, label: '剪贴板', color: 'text-emerald-500 bg-emerald-500/10', path: '/clipboard' },
}

interface GlobalSearchBarProps {
  isOpen: boolean
  onClose: () => void
}

export function GlobalSearchBar({ isOpen, onClose }: GlobalSearchBarProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setResults([])
      setSelectedIdx(0)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }
    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await globalSearch(query)
        setResults(res)
        setSelectedIdx(0)
      } catch {
        setResults([])
      } finally {
        setIsSearching(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  const handleSelect = useCallback((result: SearchResult) => {
    const config = typeConfig[result.type]
    navigate(`${config.path}?highlight=${result.type}-${result.id}`)
    onClose()
  }, [navigate, onClose])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIdx]) {
      handleSelect(results[selectedIdx])
    }
  }

  // Group results by type
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    ;(acc[r.type] ??= []).push(r)
    return acc
  }, {})

  if (!isOpen) return null

  let flatIdx = -1

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-surface/40 backdrop-blur-md animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-xl bg-surface border border-white/20 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[60vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-container-highest">
          <Search className={cn("w-5 h-5 shrink-0", isSearching ? "text-primary animate-pulse" : "text-on-surface-variant")} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索待办、灵感、语音、剪贴板..."
            className="flex-1 bg-transparent text-base text-on-surface placeholder:text-on-surface-variant/50 outline-none font-medium"
          />
          {query && (
            <button onClick={() => setQuery('')} className="p-1 text-on-surface-variant hover:text-on-surface rounded-lg hover:bg-surface-container transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:flex items-center px-2 py-0.5 bg-surface-container-high text-on-surface-variant text-[10px] font-bold rounded-md border border-white/10">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {query && results.length === 0 && !isSearching && (
            <div className="py-12 text-center text-on-surface-variant/60 text-sm">
              未找到匹配结果
            </div>
          )}

          {Object.entries(grouped).map(([type, items]) => {
            const config = typeConfig[type as SearchResultType]
            const Icon = config.icon
            return (
              <div key={type}>
                <div className="px-5 pt-3 pb-1.5 flex items-center gap-2">
                  <Icon className={cn("w-3.5 h-3.5", config.color.split(' ')[0])} />
                  <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">{config.label}</span>
                  <span className="text-[10px] text-on-surface-variant/50">({items.length})</span>
                </div>
                {items.map((item) => {
                  flatIdx++
                  const currentIdx = flatIdx
                  return (
                    <button
                      key={`${item.type}-${item.id}`}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIdx(currentIdx)}
                      className={cn(
                        "w-full flex items-center gap-3 px-5 py-3 text-left transition-colors group",
                        currentIdx === selectedIdx ? "bg-primary/10" : "hover:bg-surface-container-high"
                      )}
                    >
                      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold", config.color)}>
                        #{item.id}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-on-surface truncate">{item.title}</div>
                        <div className="text-xs text-on-surface-variant truncate mt-0.5">{item.snippet}</div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-on-surface-variant/30 group-hover:text-primary shrink-0 transition-colors" />
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Footer hint */}
        {results.length > 0 && (
          <div className="px-5 py-2.5 border-t border-surface-container-highest flex items-center gap-4 text-[11px] text-on-surface-variant/60 font-medium">
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-surface-container rounded text-[10px]">↑↓</kbd> 导航</span>
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-surface-container rounded text-[10px]">↵</kbd> 跳转</span>
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-surface-container rounded text-[10px]">ESC</kbd> 关闭</span>
          </div>
        )}
      </div>
    </div>
  )
}
