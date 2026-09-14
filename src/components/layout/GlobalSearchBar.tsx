/**
 * GlobalSearchBar — Raycast 级全局命令面板与内容检索中心 (Command Palette)
 *
 * 快捷键 Cmd+/ 或点击 Sidebar 搜索图标触发
 * 支持即时执行系统动作 (Actions) 与全库内容搜索 (Results)
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Search, X, CheckSquare, Lightbulb, Mic, Clipboard, ArrowRight,
  Timer, Trash2, Settings, BarChart3, FileType2, Flame, Command, Sparkles
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { globalSearch, type SearchResult, type SearchResultType } from '@/services/searchService'
import { clipClear } from '@/services/clipboardService'
import * as pomodoroService from '@/services/pomodoroService'
import { showToast } from '@/store/useToastStore'
import { cn } from '@/lib/utils'

const typeConfig: Record<SearchResultType, { icon: typeof Search; label: string; color: string; path: string }> = {
  todo: { icon: CheckSquare, label: '待办', color: 'text-blue-500 bg-blue-500/10', path: '/' },
  idea: { icon: Lightbulb, label: '灵感', color: 'text-amber-500 bg-amber-500/10', path: '/idea' },
  voice: { icon: Mic, label: '语音', color: 'text-rose-500 bg-rose-500/10', path: '/voice' },
  clipboard: { icon: Clipboard, label: '剪贴板', color: 'text-emerald-500 bg-emerald-500/10', path: '/clipboard' },
}

interface CommandAction {
  id: string
  title: string
  subtitle: string
  icon: React.ComponentType<{ className?: string }>
  shortcut?: string
  keywords: string[]
  run: (navigate: ReturnType<typeof useNavigate>) => Promise<void> | void
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

  // 系统预置快捷动作
  const allActions: CommandAction[] = useMemo(() => [
    {
      id: 'action_new_todo',
      title: '新建待办任务',
      subtitle: '快速捕获今日待办工作事项',
      icon: CheckSquare,
      shortcut: '⌘N',
      keywords: ['新建', '待办', 'todo', 'task', 'new', 'xj', 'db'],
      run: (nav) => {
        nav('/')
        setTimeout(() => window.dispatchEvent(new CustomEvent('flowbox:quick_create')), 50)
      }
    },
    {
      id: 'action_start_pomodoro',
      title: '开启 25min 专注番茄',
      subtitle: '启动沉浸式倒计时工作心流',
      icon: Timer,
      shortcut: '⌘2',
      keywords: ['番茄', '专注', 'pomodoro', 'focus', 'fq', 'zz', '25'],
      run: async (nav) => {
        try {
          await pomodoroService.pomodoroStart({ type: 'focus', duration_minutes: 25 })
          showToast('已开启 25min 专注番茄', 'success')
        } catch {}
        nav('/pomodoro')
      }
    },
    {
      id: 'action_start_rest',
      title: '开启 5min 极速小憩',
      subtitle: '短暂休息放松身心',
      icon: Timer,
      keywords: ['休息', '小憩', 'rest', 'break', 'xx', '5'],
      run: async (nav) => {
        try {
          await pomodoroService.pomodoroStart({ type: 'short_break', duration_minutes: 5 })
          showToast('已开启 5min 休息', 'info')
        } catch {}
        nav('/pomodoro')
      }
    },
    {
      id: 'action_clear_clipboard',
      title: '清空未置顶剪贴板',
      subtitle: '释放本地内存与冗余历史',
      icon: Trash2,
      keywords: ['清空', '剪贴板', 'clear', 'clipboard', 'qk', 'jtb'],
      run: async () => {
        await clipClear()
        showToast('已清空未置顶剪贴板记录', 'info')
      }
    },
    {
      id: 'action_nav_idea',
      title: '打开灵感便签',
      subtitle: '查看突发奇想与知识草稿',
      icon: Lightbulb,
      shortcut: '⌘3',
      keywords: ['灵感', '便签', 'idea', 'lg'],
      run: (nav) => nav('/idea')
    },
    {
      id: 'action_nav_clipboard',
      title: '打开剪贴历史',
      subtitle: '检索已复制文本、代码与截图',
      icon: Clipboard,
      shortcut: '⌘4',
      keywords: ['剪贴', '复制', 'clipboard', 'jt'],
      run: (nav) => nav('/clipboard')
    },
    {
      id: 'action_nav_voice',
      title: '打开语音速记',
      subtitle: '语音录制与 AI 智能转写',
      icon: Mic,
      shortcut: '⌘5',
      keywords: ['语音', '录音', 'voice', 'record', 'yy'],
      run: (nav) => nav('/voice')
    },
    {
      id: 'action_nav_stats',
      title: '查看效能看板',
      subtitle: '专注时长与任务完成趋势',
      icon: BarChart3,
      shortcut: '⌘8',
      keywords: ['统计', '看板', 'stats', 'report', 'tj'],
      run: (nav) => nav('/stats')
    },
    {
      id: 'action_nav_markdown',
      title: '格式转换器',
      subtitle: '网页与富文本一键转 Markdown',
      icon: FileType2,
      keywords: ['markdown', '转换', 'converter', 'zh'],
      run: (nav) => nav('/markdown')
    },
    {
      id: 'action_nav_trending',
      title: '极客热榜',
      subtitle: '浏览 GitHub 与科技热门动态',
      icon: Flame,
      keywords: ['热榜', 'trending', 'github', 'rb'],
      run: (nav) => nav('/trending')
    },
    {
      id: 'action_nav_settings',
      title: '系统偏好设置',
      subtitle: '快捷键、AI 密钥与个性化选项',
      icon: Settings,
      shortcut: '⌘,',
      keywords: ['设置', '偏好', 'settings', 'config', 'sz'],
      run: (nav) => nav('/settings')
    },
  ], [])

  // 匹配的快捷动作
  const matchedActions = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^>/, '').trim()
    if (!q) return allActions.slice(0, 5) // 默认展示前 5 个最常用动作
    return allActions.filter(act =>
      act.title.toLowerCase().includes(q) ||
      act.subtitle.toLowerCase().includes(q) ||
      act.keywords.some(k => k.toLowerCase().includes(q))
    )
  }, [allActions, query])

  // 打开时重置输入
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setResults([])
      setSelectedIdx(0)
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [isOpen])

  // 防抖内容搜索
  useEffect(() => {
    const q = query.trim()
    if (!q || q.startsWith('>')) {
      setResults([])
      return
    }
    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await globalSearch(q)
        setResults(res)
      } catch {
        setResults([])
      } finally {
        setIsSearching(false)
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [query])

  // 合并列表（用于键盘上下移动与回车选择）
  type PaletteItem = { kind: 'action'; data: CommandAction } | { kind: 'result'; data: SearchResult }
  const flatItems: PaletteItem[] = useMemo(() => {
    const list: PaletteItem[] = matchedActions.map(a => ({ kind: 'action', data: a }))
    for (const r of results) {
      list.push({ kind: 'result', data: r })
    }
    return list
  }, [matchedActions, results])

  const handleExecuteItem = useCallback((item: PaletteItem) => {
    if (item.kind === 'action') {
      item.data.run(navigate)
    } else {
      const config = typeConfig[item.data.type]
      navigate(`${config.path}?highlight=${item.data.type}-${item.data.id}`)
    }
    onClose()
  }, [navigate, onClose])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(i => Math.min(i + 1, Math.max(0, flatItems.length - 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && flatItems[selectedIdx]) {
      e.preventDefault()
      handleExecuteItem(flatItems[selectedIdx])
    }
  }

  if (!isOpen) return null

  let runningIdx = -1

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] bg-surface/50 backdrop-blur-md animate-fade-in select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-surface-container-low/95 dark:bg-surface-container/95 border border-outline-variant/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[65vh] backdrop-blur-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* 输入框顶栏 */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-outline-variant/20 bg-surface/40 shrink-0">
          <Command className={cn("w-5 h-5 shrink-0 transition-colors", isSearching ? "text-primary animate-pulse" : "text-on-surface-variant/70")} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              setSelectedIdx(0)
            }}
            onKeyDown={handleKeyDown}
            placeholder="键入指令或搜索记录 (如 >新建待办, 番茄钟, 灵感...)"
            className="flex-1 bg-transparent text-base text-on-surface placeholder:text-on-surface-variant/40 outline-none font-medium"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-on-surface-variant hover:text-on-surface rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:flex items-center px-2 py-0.5 bg-surface-container text-on-surface-variant text-[10px] font-bold rounded-lg border border-outline-variant/30">
            ESC
          </kbd>
        </div>

        {/* 主体列表 */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-3">
          {/* 快捷动作分组 */}
          {matchedActions.length > 0 && (
            <div>
              <div className="px-3 pt-1 pb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/60">
                <Sparkles className="w-3 h-3 text-primary" />
                <span>快捷指令与动作</span>
              </div>
              <div className="space-y-0.5">
                {matchedActions.map((action) => {
                  runningIdx++
                  const currentIdx = runningIdx
                  const Icon = action.icon
                  const isSelected = currentIdx === selectedIdx

                  return (
                    <button
                      key={action.id}
                      onClick={() => handleExecuteItem({ kind: 'action', data: action })}
                      onMouseEnter={() => setSelectedIdx(currentIdx)}
                      className={cn(
                        "w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-left transition-all cursor-pointer group",
                        isSelected
                          ? "bg-primary/15 text-primary font-semibold shadow-xs"
                          : "text-on-surface hover:bg-surface-container"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          "w-7 h-7 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                          isSelected ? "bg-primary text-white" : "bg-surface-container-highest text-on-surface-variant group-hover:text-on-surface"
                        )}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold truncate">{action.title}</div>
                          <div className="text-[10px] text-on-surface-variant/70 truncate">{action.subtitle}</div>
                        </div>
                      </div>

                      {action.shortcut && (
                        <kbd className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-surface-container text-on-surface-variant/70 border border-outline-variant/30">
                          {action.shortcut}
                        </kbd>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* 搜索结果分组 */}
          {results.length > 0 && (
            <div>
              <div className="px-3 pt-2 pb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/60">
                <Search className="w-3 h-3 text-primary" />
                <span>检索结果 ({results.length})</span>
              </div>
              <div className="space-y-0.5">
                {results.map((item) => {
                  runningIdx++
                  const currentIdx = runningIdx
                  const config = typeConfig[item.type]
                  const Icon = config.icon
                  const isSelected = currentIdx === selectedIdx

                  return (
                    <button
                      key={`${item.type}-${item.id}`}
                      onClick={() => handleExecuteItem({ kind: 'result', data: item })}
                      onMouseEnter={() => setSelectedIdx(currentIdx)}
                      className={cn(
                        "w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-left transition-all cursor-pointer group",
                        isSelected
                          ? "bg-primary/15 text-primary font-semibold shadow-xs"
                          : "text-on-surface hover:bg-surface-container"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn("w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold", config.color)}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold truncate text-on-surface">{item.title}</div>
                          <div className="text-[10px] text-on-surface-variant/70 truncate">{item.snippet}</div>
                        </div>
                      </div>

                      <ArrowRight className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {query && flatItems.length === 0 && !isSearching && (
            <div className="py-10 text-center text-on-surface-variant/60 text-xs font-medium">
              未找到相关指令或匹配内容
            </div>
          )}
        </div>

        {/* 底栏键盘提示 */}
        <div className="px-5 py-2.5 border-t border-outline-variant/15 bg-surface/40 flex items-center justify-between text-[10px] text-on-surface-variant/60 font-medium shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-surface-container rounded font-mono border border-outline-variant/30">↑↓</kbd> 选取</span>
            <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-surface-container rounded font-mono border border-outline-variant/30">↵</kbd> 执行/打开</span>
          </div>
          <span>支持输入 <kbd className="px-1 py-0.5 bg-surface-container rounded font-mono border border-outline-variant/30">&gt;</kbd> 过滤系统指令</span>
        </div>
      </div>
    </div>
  )
}
