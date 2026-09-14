import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Plus, Search, Mic, Clipboard as ClipboardIcon, Check,
  Trash2, CheckSquare, Sparkles, Keyboard, Play, Flag,
  Copy, CheckCircle2, Circle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTodos } from '@/hooks/useTodos'
import { useDebounce } from '@/hooks/useDebounce'
import { Button } from '@/components/ui/Button'
import { SkeletonList } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ResizablePanel } from '@/components/ui/ResizablePanel'
import { ContextMenu, type ContextMenuItem } from '@/components/ui/ContextMenu'
import { TodoDetailPanel } from '@/components/todo/TodoDetailPanel'
import type { Todo, TodoListQuery } from '@/types/todo'
import { ensureLinkedTarget, linkedTargetFor, linkedTargetId } from '@/lib/itemLink'
import { todoGet } from '@/services/todoService'
import * as pomodoroService from '@/services/pomodoroService'
import { showToast } from '@/store/useToastStore'
import { playTaskCompleteSound } from '@/lib/soundEffects'

const priorityLabels: Record<number, string> = { 0: '无', 1: '低', 2: '中', 3: '高' }
const priorityColors: Record<number, string> = {
  0: 'bg-gray-400', 1: 'bg-green-400', 2: 'bg-orange-400', 3: 'bg-red-400',
}

const PriorityDot = ({ priority }: { priority: number }) => (
  <div className={cn("w-2 h-2 rounded-full shrink-0", priorityColors[priority] ?? 'bg-gray-400')} />
)

function TodoCard({
  todo,
  isSelected,
  onToggle,
  onDelete,
  onClick,
  onContextMenu,
}: {
  todo: Todo
  isSelected?: boolean
  onToggle: (todo: Todo) => void
  onDelete: (id: number) => void
  onClick: (todo: Todo) => void
  onContextMenu?: (e: React.MouseEvent, todo: Todo) => void
}) {
  const isDone = todo.status === 'done'
  const tags: string[] = JSON.parse(todo.tags || '[]')

  return (
    <div 
      id={`todo-${todo.id}`}
      onClick={() => onClick(todo)}
      onContextMenu={(e) => onContextMenu?.(e, todo)}
      className={cn(
        "group relative flex items-start gap-3.5 p-3.5 rounded-2xl transition-all duration-200 border cursor-pointer select-none",
        isSelected
          ? "border-primary/50 bg-primary/10 shadow-md ring-1 ring-primary/30"
          : isDone 
          ? "opacity-50 bg-surface-container-low border-transparent hover:border-outline-variant/20" 
          : "bg-surface-container hover:bg-surface-container-highest border-outline-variant/20 hover:border-outline-variant/40 shadow-xs"
      )}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(todo); }}
        className={cn(
          "mt-0.5 shrink-0 flex items-center justify-center w-5 h-5 rounded-lg transition-all duration-200 cursor-pointer",
          isDone 
            ? "bg-primary text-white shadow-sm scale-100" 
            : "border-2 border-on-surface-variant/30 hover:border-primary/60 hover:scale-105"
        )}
      >
        {isDone && <Check className="w-3.5 h-3.5 stroke-[3] animate-scale-in" />}
      </button>

      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-sm font-semibold truncate transition-all duration-200",
            isDone ? "line-through text-on-surface-variant/60" : "text-on-surface"
          )}>
            {todo.title}
          </span>
          {todo.status === 'in_progress' && (
            <span className="px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[10px] font-bold shrink-0">
              🏃 进行中
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap text-xs text-on-surface-variant">
          <div className="flex items-center gap-1 shrink-0">
            <PriorityDot priority={todo.priority} />
            <span className="text-[11px]">{priorityLabels[todo.priority]}</span>
          </div>

          {todo.due_date && (
            <span className="text-[11px] bg-surface-container-highest px-2 py-0.5 rounded-md font-mono">
              📅 {todo.due_date}
            </span>
          )}

          {tags.slice(0, 2).map(tag => (
            <span key={tag} className="text-[11px] text-primary bg-primary/10 px-2 py-0.5 rounded-md font-medium">
              #{tag}
            </span>
          ))}

          {todo.source === 'voice' && <Mic className="w-3 h-3 text-rose-500 shrink-0" />}
          {todo.source === 'clipboard' && <ClipboardIcon className="w-3 h-3 text-emerald-500 shrink-0" />}
        </div>
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onDelete(todo.id); }}
        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-on-surface-variant hover:text-red-500 transition-all cursor-pointer"
        title="删除"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

type FilterKey = 'all' | 'pending' | 'in_progress' | 'done' | 'high'
const filters: { key: FilterKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待处理' },
  { key: 'in_progress', label: '进行中' },
  { key: 'done', label: '已完成' },
  { key: 'high', label: '高优先级' },
]

export function TodoPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')
  const [keyword, setKeyword] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [showInput, setShowInput] = useState(false)
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null)
  const [linkedTodo, setLinkedTodo] = useState<Todo | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; todo: Todo } | null>(null)

  // 构建查询参数（防抖搜索）
  const debouncedKeyword = useDebounce(keyword, 250)
  const query: TodoListQuery = { limit: 200 }
  if (activeFilter === 'pending' || activeFilter === 'in_progress' || activeFilter === 'done') {
    query.status = activeFilter
  }
  if (activeFilter === 'high') {
    query.priority = 3
  }
  if (debouncedKeyword.trim()) {
    query.keyword = debouncedKeyword.trim()
  }

  const { todos, loading, create, update, remove } = useTodos(query)
  const highlight = searchParams.get('highlight')
  const highlightId = linkedTargetId(highlight, 'todo')
  const displayFilter = highlightId ? 'all' : activeFilter
  const visibleTodos = useMemo(
    () => {
      const currentLinkedTodo = linkedTargetFor(highlightId, linkedTodo)
      return currentLinkedTodo && !todos.some(todo => todo.id === currentLinkedTodo.id) ? [...todos, currentLinkedTodo] : todos
    },
    [todos, highlightId, linkedTodo],
  )
  const visibleSelectedTodo = highlightId ? linkedTargetFor(highlightId, selectedTodo) : selectedTodo

  useEffect(() => {
    const timer = window.setTimeout(() => setSelectedTodo(null), 0)
    return () => window.clearTimeout(timer)
  }, [highlight])

  useEffect(() => {
    if (loading || !highlightId) return
    let cancelled = false
    void ensureLinkedTarget(visibleTodos, highlightId, todoGet).then(({ target }) => {
      if (!cancelled && !visibleTodos.includes(target)) setLinkedTodo(target)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [highlightId, loading, visibleTodos])

  useEffect(() => {
    if (loading || !highlightId || !highlight) return
    const todo = visibleTodos.find(item => item.id === highlightId)
    const target = document.getElementById(highlight)
    if (!todo || !target) return
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    target.classList.add('ring-2', 'ring-primary')
    const selectionTimer = window.setTimeout(() => setSelectedTodo(todo), 0)
    const timer = window.setTimeout(() => target.classList.remove('ring-2', 'ring-primary'), 1800)
    return () => {
      window.clearTimeout(selectionTimer)
      window.clearTimeout(timer)
    }
  }, [highlight, highlightId, loading, visibleTodos])

  const pendingTodos = displayFilter === 'all' ? visibleTodos.filter(t => t.status === 'pending') : visibleTodos.filter(t => t.status !== 'done')
  const inProgressTodos = displayFilter === 'all' ? visibleTodos.filter(t => t.status === 'in_progress') : []
  const doneTodos = displayFilter === 'all' ? visibleTodos.filter(t => t.status === 'done') : visibleTodos.filter(t => t.status === 'done')

  const handleToggle = async (todo: Todo) => {
    const nextStatus = todo.status === 'done' ? 'pending' : 'done'
    if (nextStatus === 'done') {
      playTaskCompleteSound()
    }
    await update({ id: todo.id, status: nextStatus })
  }

  const handleCreate = async () => {
    if (!newTitle.trim()) return
    await create({ title: newTitle.trim(), priority: 0 })
    setNewTitle('')
    setShowInput(false)
  }

  // 键盘导航与快捷心流
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement
      const isInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA' || activeEl?.getAttribute('contenteditable') === 'true'
      if (isInput) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (visibleTodos.length === 0) return
        if (!selectedTodo) {
          setSelectedTodo(visibleTodos[0])
        } else {
          const currentIndex = visibleTodos.findIndex(t => t.id === selectedTodo.id)
          if (currentIndex < visibleTodos.length - 1) {
            setSelectedTodo(visibleTodos[currentIndex + 1])
          }
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (visibleTodos.length === 0) return
        if (!selectedTodo) {
          setSelectedTodo(visibleTodos[visibleTodos.length - 1])
        } else {
          const currentIndex = visibleTodos.findIndex(t => t.id === selectedTodo.id)
          if (currentIndex > 0) {
            setSelectedTodo(visibleTodos[currentIndex - 1])
          }
        }
      } else if (e.key === ' ' && selectedTodo) {
        e.preventDefault()
        handleToggle(selectedTodo)
      } else if (e.key === 'Escape') {
        if (selectedTodo) {
          setSelectedTodo(null)
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
  }, [visibleTodos, selectedTodo, showInput])

  const activeTodoForPanel = visibleSelectedTodo

  // 统计数据
  const completedCount = useMemo(() => visibleTodos.filter(t => t.status === 'done').length, [visibleTodos])
  const pendingCount = useMemo(() => visibleTodos.filter(t => t.status !== 'done').length, [visibleTodos])
  const highPriorityCount = useMemo(() => visibleTodos.filter(t => t.priority === 3 && t.status !== 'done').length, [visibleTodos])

  // 右键菜单项生成
  const contextMenuItems = useMemo((): ContextMenuItem[] => {
    if (!contextMenu) return []
    const { todo } = contextMenu
    const isDone = todo.status === 'done'

    return [
      {
        key: 'toggle',
        label: isDone ? '恢复为待处理' : '标记为已完成',
        icon: isDone ? Circle : CheckCircle2,
        shortcut: 'Space',
        onClick: () => handleToggle(todo),
      },
      {
        key: 'focus',
        label: '开启 25min 专注番茄',
        icon: Play,
        shortcut: 'P',
        onClick: async () => {
          try {
            await pomodoroService.pomodoroStart({
              type: 'focus',
              duration_minutes: 25,
              related_todo_id: todo.id,
            })
            showToast(`已开启专注：${todo.title}`, 'success')
            navigate('/pomodoro')
          } catch (err) {
            showToast(`启动失败: ${String(err)}`, 'error')
          }
        }
      },
      {
        key: 'priority',
        label: todo.priority === 3 ? '设为默认优先级' : '设为高优先级',
        icon: Flag,
        onClick: async () => {
          await update({ id: todo.id, priority: todo.priority === 3 ? 0 : 3 })
        }
      },
      {
        key: 'copy',
        label: '复制任务标题',
        icon: Copy,
        shortcut: '⌘C',
        onClick: async () => {
          await navigator.clipboard.writeText(todo.title)
          showToast('标题已复制', 'success')
        }
      },
      { key: 'sep', label: '', separator: true },
      {
        key: 'delete',
        label: '删除此任务',
        icon: Trash2,
        shortcut: '⌫',
        danger: true,
        onClick: async () => {
          await remove(todo.id)
          if (selectedTodo?.id === todo.id) setSelectedTodo(null)
        }
      }
    ]
  }, [contextMenu, selectedTodo, navigate, update, remove])

  return (
    <div className="flex flex-col lg:flex-row h-full gap-6 w-full min-w-0 overflow-hidden animate-fade-in">
      
      {/* ── 左栏 Master：支持拖拽调宽的工作流列表 ── */}
      <ResizablePanel
        id="todo"
        defaultWidth={390}
        minWidth={280}
        maxWidth={560}
        className={cn(
          "transition-all duration-300",
          activeTodoForPanel ? "hidden lg:flex" : "flex"
        )}
      >
        {/* 顶部搜索与过滤 */}
        <div className="flex flex-col gap-3 pb-4 border-b border-outline-variant/15 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                placeholder="搜索待办... (⌘N 新建)"
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                className="w-full h-10 bg-surface-container-low pl-9 pr-3 rounded-xl text-xs placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium border border-outline-variant/20"
              />
            </div>
            <Button
              onClick={() => setShowInput(v => !v)}
              variant="primary"
              size="sm"
              className="shrink-0 text-xs px-3.5 h-10 rounded-xl cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>新建</span>
            </Button>
          </div>

          {/* 状态分类标签 */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {filters.map(f => (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap",
                  displayFilter === f.key
                    ? "bg-primary/15 text-primary font-bold shadow-xs border border-primary/20"
                    : "text-on-surface-variant/80 hover:text-on-surface hover:bg-surface-container-low"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* 快速新建框 */}
        {showInput && (
          <div className="py-3 flex gap-2 animate-fade-in shrink-0">
            <input
              autoFocus
              type="text"
              placeholder="输入待办标题，按回车保存..."
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') setShowInput(false)
              }}
              className="flex-1 h-10 bg-surface-container pl-3.5 pr-3 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all border border-outline-variant/30 font-medium"
            />
            <Button onClick={handleCreate} variant="primary" size="sm" className="h-10 px-3 text-xs">
              保存
            </Button>
            <Button onClick={() => setShowInput(false)} variant="secondary" size="sm" className="h-10 px-2.5 text-xs">
              取消
            </Button>
          </div>
        )}

        {/* 骨架加载态 */}
        {loading && (
          <div className="py-4">
            <SkeletonList count={3} />
          </div>
        )}

        {/* 任务流 */}
        {!loading && (
          visibleTodos.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-4">
              <EmptyState
                icon={<CheckSquare className="w-8 h-8 text-primary" />}
                title="暂无待办事项"
                description="点击上方「新建」或按 ⌘N 快速捕获新任务"
                action={
                  <Button onClick={() => setShowInput(true)} variant="primary" size="sm">
                    <Plus className="w-3.5 h-3.5" /> 立即新建
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto pt-3 pb-8 space-y-6 no-scrollbar">
              {/* 进行中 */}
              {inProgressTodos.length > 0 && (
                <section>
                  <div className="text-xs font-bold text-on-surface-variant mb-2.5 flex items-center gap-2 px-1">
                    <span>进行中</span>
                    <span className="bg-surface-container px-2 py-0.5 rounded-full text-[10px] font-bold text-on-surface-variant">{inProgressTodos.length}</span>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {inProgressTodos.map(t => (
                      <TodoCard
                        key={t.id}
                        todo={t}
                        isSelected={activeTodoForPanel?.id === t.id}
                        onToggle={handleToggle}
                        onDelete={remove}
                        onClick={setSelectedTodo}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          setContextMenu({ x: e.clientX, y: e.clientY, todo: t })
                        }}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* 待处理 */}
              {pendingTodos.length > 0 && (
                <section>
                  <div className="text-xs font-bold text-on-surface-variant mb-2.5 flex items-center gap-2 px-1">
                    <span>{displayFilter === 'all' ? '待处理' : filters.find(f => f.key === displayFilter)?.label ?? '待处理'}</span>
                    <span className="bg-surface-container px-2 py-0.5 rounded-full text-[10px] font-bold text-on-surface-variant">{pendingTodos.length}</span>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {pendingTodos.map(t => (
                      <TodoCard
                        key={t.id}
                        todo={t}
                        isSelected={activeTodoForPanel?.id === t.id}
                        onToggle={handleToggle}
                        onDelete={remove}
                        onClick={setSelectedTodo}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          setContextMenu({ x: e.clientX, y: e.clientY, todo: t })
                        }}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* 已完成 */}
              {doneTodos.length > 0 && displayFilter === 'all' && (
                <section className="opacity-70">
                  <div className="text-xs font-bold text-on-surface-variant mb-2.5 flex items-center gap-2 px-1">
                    <span>已完成</span>
                    <span className="bg-surface-container px-2 py-0.5 rounded-full text-[10px] font-bold text-on-surface-variant">{doneTodos.length}</span>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {doneTodos.map(t => (
                      <TodoCard
                        key={t.id}
                        todo={t}
                        isSelected={activeTodoForPanel?.id === t.id}
                        onToggle={handleToggle}
                        onDelete={remove}
                        onClick={setSelectedTodo}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          setContextMenu({ x: e.clientX, y: e.clientY, todo: t })
                        }}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )
        )}
      </ResizablePanel>

      {/* ── 右栏 Detail：深度工作台 / 心流仪表盘 ── */}
      <div className={cn(
        "flex-1 h-full min-w-0 flex-col overflow-hidden transition-all duration-300",
        activeTodoForPanel ? "flex" : "hidden lg:flex"
      )}>
        {activeTodoForPanel ? (
          <TodoDetailPanel
            todo={activeTodoForPanel}
            onClose={() => setSelectedTodo(null)}
            onUpdate={async (payload) => {
              const updated = await update(payload)
              if (updated) {
                setSelectedTodo(prev => prev?.id === updated.id ? { ...prev, ...updated } : prev)
              }
            }}
            onDelete={async (id) => {
              await remove(id)
              setSelectedTodo(null)
            }}
          />
        ) : (
          /* 未选中任何待办时的右侧沉浸式心流看板 */
          <div className="h-full flex flex-col justify-between p-8 bg-surface-container/30 border border-outline-variant/20 rounded-3xl backdrop-blur-xl animate-fade-in select-none">
            {/* 顶栏卡片 */}
            <div>
              <div className="flex items-center gap-2.5 text-primary mb-2">
                <Sparkles className="w-5 h-5" />
                <span className="text-xs font-bold tracking-wider uppercase">FlowBox 今日工作台</span>
              </div>
              <h2 className="text-2xl font-display font-bold text-on-surface">选择任意待办进入深度工作</h2>
              <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed max-w-md">
                使用鼠标点击或按 <kbd className="px-1 py-0.5 rounded bg-surface-container border border-outline-variant/30 font-mono text-[10px]">↑</kbd> <kbd className="px-1 py-0.5 rounded bg-surface-container border border-outline-variant/30 font-mono text-[10px]">↓</kbd> 切换任务，按 <kbd className="px-1 py-0.5 rounded bg-surface-container border border-outline-variant/30 font-mono text-[10px]">Space</kbd> 勾选完成。
              </p>
            </div>

            {/* 统计指标卡片 */}
            <div className="grid grid-cols-3 gap-4 my-6">
              <div className="bg-surface-container/60 p-4 rounded-2xl border border-outline-variant/20">
                <div className="text-[11px] font-bold text-on-surface-variant mb-1">待处理</div>
                <div className="text-3xl font-display font-bold text-on-surface">{pendingCount}</div>
              </div>
              <div className="bg-surface-container/60 p-4 rounded-2xl border border-outline-variant/20">
                <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mb-1">已完成</div>
                <div className="text-3xl font-display font-bold text-emerald-600 dark:text-emerald-400">{completedCount}</div>
              </div>
              <div className="bg-surface-container/60 p-4 rounded-2xl border border-outline-variant/20">
                <div className="text-[11px] font-bold text-rose-500 mb-1">高优先级</div>
                <div className="text-3xl font-display font-bold text-rose-500">{highPriorityCount}</div>
              </div>
            </div>

            {/* 快捷键提示条 */}
            <div className="bg-surface-container-low/80 p-4 rounded-2xl border border-outline-variant/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Keyboard className="w-5 h-5 text-on-surface-variant" />
                <div className="text-xs">
                  <span className="font-bold text-on-surface">桌面快捷指令：</span>
                  <span className="text-on-surface-variant ml-1">
                    右键卡片唤起快捷菜单，按 <kbd className="px-1.5 py-0.5 bg-surface-container text-[10px] rounded font-mono border border-outline-variant/30">⌘N</kbd> 快速捕获
                  </span>
                </div>
              </div>
              <Button onClick={() => setShowInput(true)} variant="secondary" size="sm" className="text-xs">
                新建任务
              </Button>
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
    </div>
  )
}
