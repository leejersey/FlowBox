import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Sparkles, Mic, Clipboard as ClipboardIcon,
  Archive, Trash2, CheckSquare, Clock, Copy, Plus
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { cn } from '@/lib/utils'
import type { Idea } from '@/types/idea'
import { useIdeas } from '@/hooks/useIdeas'
import { ResizablePanel } from '@/components/ui/ResizablePanel'
import { ContextMenu, type ContextMenuItem } from '@/components/ui/ContextMenu'
import { IdeaDetailPanel } from '@/components/idea/IdeaDetailPanel'
import { EmptyState } from '@/components/ui/EmptyState'
import { LinkPanel } from '@/components/links/LinkPanel'
import { ensureLinkedTarget, linkedTargetFor, linkedTargetId } from '@/lib/itemLink'
import { ideaGet } from '@/services/ideaService'
import { todoCreate } from '@/services/todoService'
import { showToast } from '@/store/useToastStore'
import { playCopySuccessSound } from '@/lib/soundEffects'

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const d = new Date(dateStr).getTime()
  const diff = now - d
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return dateStr.slice(5, 10)
}

function parseIdeaTags(tags: string | null): string[] {
  try {
    return JSON.parse(tags || '[]')
  } catch {
    return []
  }
}

// 紧凑型左侧 Master 灵感卡片
function IdeaCard({
  idea,
  isSelected,
  onArchive,
  onDelete,
  onClick,
  onContextMenu,
}: {
  idea: Idea
  isSelected?: boolean
  onArchive: (id: number) => void
  onDelete: (id: number) => void
  onClick: (idea: Idea) => void
  onContextMenu?: (e: React.MouseEvent, idea: Idea) => void
}) {
  const currentTags = parseIdeaTags(idea.tags)

  return (
    <div
      id={`idea-${idea.id}`}
      onClick={() => onClick(idea)}
      onContextMenu={(e) => onContextMenu?.(e, idea)}
      className={cn(
        "group relative flex flex-col p-3.5 rounded-2xl transition-all duration-200 border cursor-pointer select-none",
        isSelected
          ? "border-primary/50 bg-primary/10 shadow-md ring-1 ring-primary/30"
          : idea.is_archived === 1
          ? "opacity-50 bg-surface-container-low border-transparent hover:border-outline-variant/20"
          : "bg-surface-container hover:bg-surface-container-highest border-outline-variant/20 hover:border-outline-variant/40 shadow-xs"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-xs font-semibold text-on-surface line-clamp-2 leading-relaxed flex-1">
          {idea.content}
        </p>
        <span className="text-[10px] text-on-surface-variant/60 font-medium shrink-0 flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" />
          {timeAgo(idea.created_at)}
        </span>
      </div>

      <div className="flex items-center justify-between mt-2 pt-1 border-t border-outline-variant/10 text-[10px]">
        <div className="flex items-center gap-1.5 flex-wrap">
          {currentTags.slice(0, 3).map(tag => (
            <span key={tag} className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
              #{tag}
            </span>
          ))}
          {idea.source === 'voice' && <Mic className="w-3 h-3 text-rose-500 shrink-0" />}
          {idea.source === 'clipboard' && <ClipboardIcon className="w-3 h-3 text-emerald-500 shrink-0" />}
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onArchive(idea.id) }}
            className="p-1 hover:bg-surface-container-highest rounded text-on-surface-variant hover:text-on-surface"
            title="归档"
          >
            <Archive className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(idea.id) }}
            className="p-1 hover:bg-red-500/10 hover:text-red-500 rounded text-on-surface-variant"
            title="删除"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function IdeaPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { ideas, loading, createIdea, updateIdea, archiveIdea, deleteIdea } = useIdeas()
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null)
  const [linkedIdea, setLinkedIdea] = useState<Idea | null>(null)
  const [linkId, setLinkId] = useState<number | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; idea: Idea } | null>(null)

  const [keyword, setKeyword] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newTags, setNewTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [showInput, setShowInput] = useState(false)
  const lastOpenedHighlightRef = useRef<string | null>(null)

  const highlight = searchParams.get('highlight')
  const highlightId = linkedTargetId(highlight, 'idea')
  const currentLinkedIdea = linkedTargetFor(highlightId, linkedIdea)
  const visibleIdeas = useMemo(
    () => currentLinkedIdea && !ideas.some(idea => idea.id === currentLinkedIdea.id) ? [...ideas, currentLinkedIdea] : ideas,
    [ideas, currentLinkedIdea],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => setSelectedIdea(null), 0)
    return () => window.clearTimeout(timer)
  }, [highlight])

  useEffect(() => {
    if (loading || !highlightId) return
    let cancelled = false
    void ensureLinkedTarget(visibleIdeas, highlightId, ideaGet).then(({ target }) => {
      if (!cancelled && !visibleIdeas.includes(target)) setLinkedIdea(target)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [highlightId, loading, visibleIdeas])

  useEffect(() => {
    if (loading || !highlightId || !highlight) return
    const idea = visibleIdeas.find(item => item.id === highlightId)
    if (!idea || lastOpenedHighlightRef.current === highlight) return

    const selectionTimer = window.setTimeout(() => {
      lastOpenedHighlightRef.current = highlight
      setSelectedIdea(idea)
    }, 0)
    const target = document.getElementById(highlight)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      target.classList.add('ring-2', 'ring-primary')
    }
    const highlightTimer = target
      ? window.setTimeout(() => target.classList.remove('ring-2', 'ring-primary'), 1800)
      : undefined
    return () => {
      window.clearTimeout(selectionTimer)
      if (highlightTimer !== undefined) window.clearTimeout(highlightTimer)
    }
  }, [highlight, highlightId, loading, visibleIdeas])

  const handleSave = async () => {
    if (!newContent.trim()) return
    await createIdea(newContent.trim(), newTags)
    setNewContent('')
    setNewTags([])
    setTagInput('')
    setShowInput(false)
  }

  const handleAddNewTag = () => {
    const trimmed = tagInput.trim()
    if (!trimmed) return
    if (!newTags.includes(trimmed)) {
      setNewTags([...newTags, trimmed])
    }
    setTagInput('')
  }

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement
      const isInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA' || activeEl?.getAttribute('contenteditable') === 'true'
      if (isInput) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (visibleIdeas.length === 0) return
        if (!selectedIdea) {
          setSelectedIdea(visibleIdeas[0])
        } else {
          const currentIndex = visibleIdeas.findIndex(i => i.id === selectedIdea.id)
          if (currentIndex < visibleIdeas.length - 1) {
            setSelectedIdea(visibleIdeas[currentIndex + 1])
          }
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (visibleIdeas.length === 0) return
        if (!selectedIdea) {
          setSelectedIdea(visibleIdeas[visibleIdeas.length - 1])
        } else {
          const currentIndex = visibleIdeas.findIndex(i => i.id === selectedIdea.id)
          if (currentIndex > 0) {
            setSelectedIdea(visibleIdeas[currentIndex - 1])
          }
        }
      } else if (e.key === 'Escape') {
        if (selectedIdea) {
          setSelectedIdea(null)
        } else if (showInput) {
          setShowInput(false)
        }
      }
    }

    const handleQuickCreate = () => {
      setShowInput(true)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('flowbox:quick_create', handleQuickCreate)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('flowbox:quick_create', handleQuickCreate)
    }
  }, [visibleIdeas, selectedIdea, showInput])

  // 过滤后的列表
  const filteredIdeas = useMemo(() => {
    if (!keyword.trim()) return visibleIdeas
    const lower = keyword.toLowerCase()
    return visibleIdeas.filter(i => i.content.toLowerCase().includes(lower) || i.tags.toLowerCase().includes(lower))
  }, [visibleIdeas, keyword])

  // 右键菜单项生成
  const contextMenuItems = useMemo((): ContextMenuItem[] => {
    if (!contextMenu) return []
    const { idea } = contextMenu

    return [
      {
        key: 'copy',
        label: '复制灵感文本',
        icon: Copy,
        shortcut: '⌘C',
        onClick: async () => {
          await navigator.clipboard.writeText(idea.content)
          playCopySuccessSound()
          showToast('灵感内容已复制', 'success')
        }
      },
      {
        key: 'to_todo',
        label: '一键沉淀为待办',
        icon: CheckSquare,
        shortcut: 'T',
        onClick: async () => {
          try {
            const lines = idea.content.split('\n').filter(Boolean)
            const title = (lines[0] || '灵感任务').slice(0, 60)
            const detail = lines.slice(1).join('\n').trim()
            const newTodo = await todoCreate({
              title,
              content: detail || idea.content,
              priority: 1,
              source: 'manual',
              tags: ['灵感转化'],
            })
            showToast('已沉淀为待办！', 'success')
            navigate(`/?highlight=todo-${newTodo.id}`)
          } catch (err) {
            showToast(`转化失败: ${String(err)}`, 'error')
          }
        }
      },
      {
        key: 'archive',
        label: idea.is_archived === 1 ? '取消归档' : '归档此灵感',
        icon: Archive,
        onClick: () => archiveIdea(idea.id),
      },
      { key: 'sep', label: '', separator: true },
      {
        key: 'delete',
        label: '删除此灵感',
        icon: Trash2,
        shortcut: '⌫',
        danger: true,
        onClick: () => {
          deleteIdea(idea.id)
          if (selectedIdea?.id === idea.id) setSelectedIdea(null)
        }
      }
    ]
  }, [contextMenu, selectedIdea, navigate, archiveIdea, deleteIdea])

  return (
    <div className="flex flex-col lg:flex-row h-full gap-6 w-full min-w-0 overflow-hidden animate-fade-in">
      
      {/* ── 左栏 Master：支持拖拽调宽的灵感卡片流 ── */}
      <ResizablePanel
        id="idea"
        defaultWidth={390}
        minWidth={280}
        maxWidth={560}
        className={cn(
          "transition-all duration-300",
          selectedIdea ? "hidden lg:flex" : "flex"
        )}
      >
        {/* 顶部搜索与过滤 */}
        <div className="flex flex-col gap-3 pb-4 border-b border-outline-variant/15 shrink-0">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="搜索灵感与标签... (⌘N 新建)"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              className="w-full h-10 bg-surface-container-low px-3.5 rounded-xl text-xs placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium border border-outline-variant/20"
            />
            <button
              onClick={() => setShowInput(v => !v)}
              className="shrink-0 flex items-center gap-1.5 px-3.5 h-10 rounded-xl text-xs font-bold bg-primary text-white hover:opacity-90 transition-all cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>记灵感</span>
            </button>
          </div>
        </div>

        {/* 快速新建框 */}
        {showInput && (
          <div className="py-3 flex flex-col gap-2.5 animate-fade-in shrink-0 bg-surface-container-low/70 p-3.5 rounded-2xl border border-outline-variant/20 my-2">
            <textarea
              autoFocus
              placeholder="随时捕捉你的灵感想法..."
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave()
                if (e.key === 'Escape') setShowInput(false)
              }}
              className="w-full bg-surface-container rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all border border-outline-variant/20 font-medium resize-none min-h-[70px]"
            />

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="+ 添加标签 (Enter)"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddNewTag()}
                className="flex-1 bg-surface-container h-8 px-2.5 rounded-lg text-xs outline-none border border-outline-variant/20"
              />
              <button
                onClick={handleSave}
                disabled={!newContent.trim()}
                className="h-8 px-3 rounded-lg text-xs font-bold bg-primary text-white disabled:opacity-50 cursor-pointer"
              >
                保存
              </button>
              <button
                onClick={() => setShowInput(false)}
                className="h-8 px-2 rounded-lg text-xs text-on-surface-variant hover:bg-surface-container cursor-pointer"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {/* 灵感便签流 */}
        {!loading && (
          filteredIdeas.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-4">
              <EmptyState
                icon={<Sparkles className="w-8 h-8 text-primary" />}
                title="暂无灵感便签"
                description="随时按 ⌘N 或点击右上角「记灵感」快速捕捉创意"
              />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto pt-3 pb-8 space-y-3 no-scrollbar">
              {filteredIdeas.map(idea => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  isSelected={selectedIdea?.id === idea.id}
                  onArchive={archiveIdea}
                  onDelete={deleteIdea}
                  onClick={setSelectedIdea}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setContextMenu({ x: e.clientX, y: e.clientY, idea })
                  }}
                />
              ))}
            </div>
          )
        )}
      </ResizablePanel>

      {/* ── 右栏 Detail：深度工作台 / 脑力看板 ── */}
      <div className={cn(
        "flex-1 h-full min-w-0 flex-col overflow-hidden transition-all duration-300",
        selectedIdea ? "flex" : "hidden lg:flex"
      )}>
        {selectedIdea && (
          <IdeaDetailPanel
            idea={selectedIdea}
            onClose={() => setSelectedIdea(null)}
            onUpdate={updateIdea}
            onDelete={deleteIdea}
            onArchive={archiveIdea}
          />
        )}
        {!selectedIdea && (
          /* 未选中任何灵感时的脑力沉浸看板 */
          <div className="h-full flex flex-col justify-between p-8 bg-surface-container/30 border border-outline-variant/20 rounded-3xl backdrop-blur-xl animate-fade-in select-none">
            <div>
              <div className="flex items-center gap-2.5 text-primary mb-2">
                <Sparkles className="w-5 h-5" />
                <span className="text-xs font-bold tracking-wider uppercase">创意与灵感集散地</span>
              </div>
              <h2 className="text-2xl font-display font-bold text-on-surface">选择便签进入沉浸创作</h2>
              <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed max-w-md">
                在左侧列表中点击或按 <kbd className="px-1 py-0.5 rounded bg-surface-container border border-outline-variant/30 font-mono text-[10px]">↑</kbd> <kbd className="px-1 py-0.5 rounded bg-surface-container border border-outline-variant/30 font-mono text-[10px]">↓</kbd> 选取灵感，支持失焦自动保存与一键转化为待办事项。
              </p>
            </div>

            {/* 灵感脑力统计 */}
            <div className="grid grid-cols-2 gap-4 my-6">
              <div className="bg-surface-container/60 p-5 rounded-2xl border border-outline-variant/20">
                <div className="text-[11px] font-bold text-on-surface-variant mb-1">灵感便签总数</div>
                <div className="text-3xl font-display font-bold text-on-surface">{ideas.length}</div>
              </div>
              <div className="bg-surface-container/60 p-5 rounded-2xl border border-outline-variant/20">
                <div className="text-[11px] font-bold text-amber-500 mb-1">活跃灵感</div>
                <div className="text-3xl font-display font-bold text-amber-500">{ideas.filter(i => i.is_archived === 0).length}</div>
              </div>
            </div>

            {/* 快捷操作提示条 */}
            <div className="bg-surface-container-low/80 p-4 rounded-2xl border border-outline-variant/20 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-on-surface font-medium">随时按 <kbd className="font-mono bg-surface-container px-1 py-0.5 rounded border border-outline-variant/30">⌘N</kbd> 记录脑中新火花</span>
              </div>
              <button
                onClick={() => setShowInput(true)}
                className="text-xs font-bold text-primary hover:underline cursor-pointer"
              >
                新建便签
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 右键上下文菜单 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}

      {linkId !== null && <LinkPanel type="idea" id={linkId} onClose={() => setLinkId(null)} />}
    </div>
  )
}
