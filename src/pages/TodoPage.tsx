import { useState } from 'react'
import { Plus, Search, Mic, Clipboard as ClipboardIcon, Check, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTodos } from '@/hooks/useTodos'
import { TodoDetailModal } from '@/components/todo/TodoDetailModal'
import type { Todo, TodoListQuery } from '@/types/todo'

const priorityLabels: Record<number, string> = { 0: '无', 1: '低', 2: '中', 3: '高' }
const priorityColors: Record<number, string> = {
  0: 'bg-gray-400', 1: 'bg-green-400', 2: 'bg-orange-400', 3: 'bg-red-400',
}

const PriorityDot = ({ priority }: { priority: number }) => (
  <div className={cn("w-2.5 h-2.5 rounded-full", priorityColors[priority] ?? 'bg-gray-400')} />
)

function TodoCard({ todo, onToggle, onDelete, onClick }: {
  todo: Todo
  onToggle: (todo: Todo) => void
  onDelete: (id: number) => void
  onClick: (todo: Todo) => void
}) {
  const isDone = todo.status === 'done'
  const tags: string[] = JSON.parse(todo.tags || '[]')

  return (
    <div 
      onClick={() => onClick(todo)}
      className={cn(
      "group flex items-start gap-4 p-4 rounded-2xl transition-all duration-200",
      isDone ? "opacity-50" : "bg-surface-container hover:bg-surface-container-highest cursor-pointer"
    )}>
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(todo); }}
        className={cn(
          "mt-0.5 shrink-0 flex items-center justify-center w-5 h-5 rounded hover:bg-primary/10 transition-colors",
          isDone ? "bg-primary text-white" : "border-2 border-on-surface-variant/30"
        )}
      >
        {isDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
      </button>

      <div className="flex-1 flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span className={cn(
            "text-[15px] font-medium transition-colors",
            isDone ? "line-through text-on-surface-variant" : "text-on-surface"
          )}>
            {todo.title}
          </span>
          {todo.status === 'in_progress' && (
            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[11px] font-bold flex items-center gap-1">
              🏃 进行中
            </span>
          )}
          {todo.source === 'voice' && (
            <span
              onClick={(e) => { e.stopPropagation(); window.location.href = `/voice?highlight=voice-${todo.source_id}` }}
              className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 text-[11px] font-bold flex items-center gap-1 cursor-pointer hover:bg-rose-500/20 transition-colors"
              title={`来自语音 #${todo.source_id}`}
            >
              <Mic className="w-3 h-3" /> 语音 #{todo.source_id}
            </span>
          )}
          {todo.source === 'clipboard' && (
            <span
              onClick={(e) => { e.stopPropagation(); window.location.href = `/clipboard?highlight=clipboard-${todo.source_id}` }}
              className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[11px] font-bold flex items-center gap-1 cursor-pointer hover:bg-emerald-500/20 transition-colors"
              title={`来自剪贴板 #${todo.source_id}`}
            >
              <ClipboardIcon className="w-3 h-3" /> 剪贴板 #{todo.source_id}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 flex-wrap mt-0.5">
          <div className="flex items-center gap-1.5 shrink-0">
            <PriorityDot priority={todo.priority} />
            <span className="text-xs text-on-surface-variant">{priorityLabels[todo.priority]}优先级</span>
          </div>

          {todo.due_date && (
            <span className="text-xs text-on-surface-variant bg-white/50 px-2.5 py-1 rounded-md">
              📅 {todo.due_date}
            </span>
          )}

          {tags.map(tag => (
            <span key={tag} className="text-xs text-primary bg-primary/5 px-2.5 py-1 rounded-md font-medium">
              {tag}
            </span>
          ))}

          {todo.source === 'voice' && <Mic className="w-3.5 h-3.5 text-on-surface-variant" />}
          {todo.source === 'clipboard' && <ClipboardIcon className="w-3.5 h-3.5 text-on-surface-variant" />}
        </div>
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onDelete(todo.id); }}
        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-red-500/10 text-on-surface-variant hover:text-red-500 transition-all"
      >
        <Trash2 className="w-4 h-4" />
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
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')
  const [keyword, setKeyword] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [showInput, setShowInput] = useState(false)
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null)

  // 构建查询参数
  const query: TodoListQuery = { limit: 200 }
  if (activeFilter === 'pending' || activeFilter === 'in_progress' || activeFilter === 'done') {
    query.status = activeFilter
  }
  if (activeFilter === 'high') {
    query.priority = 3
  }
  if (keyword.trim()) {
    query.keyword = keyword.trim()
  }

  const { todos, loading, create, update, remove } = useTodos(query)

  const pendingTodos = activeFilter === 'all' ? todos.filter(t => t.status === 'pending') : todos.filter(t => t.status !== 'done')
  const inProgressTodos = activeFilter === 'all' ? todos.filter(t => t.status === 'in_progress') : []
  const doneTodos = activeFilter === 'all' ? todos.filter(t => t.status === 'done') : todos.filter(t => t.status === 'done')

  const handleToggle = async (todo: Todo) => {
    const nextStatus = todo.status === 'done' ? 'pending' : 'done'
    await update({ id: todo.id, status: nextStatus })
  }

  const handleCreate = async () => {
    if (!newTitle.trim()) return
    await create({ title: newTitle.trim(), priority: 0 })
    setNewTitle('')
    setShowInput(false)
  }

  return (
    <div className="flex flex-col h-full animate-fade-in w-full max-w-4xl mx-auto overflow-y-auto overflow-x-hidden pb-10">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between gap-6 mb-8 mt-2 sticky top-0 z-10 bg-surface/80 backdrop-blur-xl py-4 -mx-2 px-2">
        <div className="flex-1 max-w-md relative group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="搜索待办..."
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            className="w-full h-11 bg-surface-container-low pl-10 pr-4 rounded-full text-sm placeholder:text-on-surface-variant/70 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
          />
        </div>

        <div className="flex items-center gap-2">
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

        <button
          onClick={() => setShowInput(true)}
          className="primary-gradient-button h-11 px-6 rounded-full flex items-center gap-2 font-medium text-sm whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          新建待办
        </button>
      </div>

      {/* Quick Add Input */}
      {showInput && (
        <div className="mb-6 flex gap-3 animate-fade-in">
          <input
            autoFocus
            type="text"
            placeholder="输入待办标题，按回车保存..."
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            className="flex-1 h-12 bg-surface-container pl-5 pr-4 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
          <button onClick={handleCreate} className="primary-gradient-button h-12 px-6 rounded-2xl font-medium text-sm">
            保存
          </button>
          <button onClick={() => setShowInput(false)} className="h-12 px-4 rounded-2xl bg-surface-container text-on-surface-variant text-sm">
            取消
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center text-on-surface-variant py-12">加载中...</div>
      )}

      {/* Main List */}
      <div className="flex-1 overflow-y-auto pb-20 space-y-10">

        {activeFilter === 'all' && inProgressTodos.length > 0 && (
          <section>
            <h2 className="text-xl font-display font-bold mb-6 flex items-center gap-3">
              进行中
              <span className="bg-surface-container px-2.5 py-0.5 rounded-full text-xs font-bold text-on-surface-variant">{inProgressTodos.length}</span>
            </h2>
            <div className="flex flex-col gap-3">
              {inProgressTodos.map(t => <TodoCard key={t.id} todo={t} onToggle={handleToggle} onDelete={remove} onClick={setSelectedTodo} />)}
            </div>
          </section>
        )}

        {pendingTodos.length > 0 && (
          <section>
            <h2 className="text-xl font-display font-bold mb-6 flex items-center gap-3">
              {activeFilter === 'all' ? '待处理' : filters.find(f => f.key === activeFilter)?.label ?? '结果'}
              <span className="bg-surface-container px-2.5 py-0.5 rounded-full text-xs font-bold text-on-surface-variant">{pendingTodos.length}</span>
            </h2>
            <div className="flex flex-col gap-3">
              {pendingTodos.map(t => <TodoCard key={t.id} todo={t} onToggle={handleToggle} onDelete={remove} onClick={setSelectedTodo} />)}
            </div>
          </section>
        )}

        {doneTodos.length > 0 && activeFilter === 'all' && (
          <section className="opacity-70 grayscale-[0.2]">
            <h2 className="text-lg font-display font-semibold mb-6 flex items-center gap-3">已完成</h2>
            <div className="flex flex-col gap-3">
              {doneTodos.map(t => <TodoCard key={t.id} todo={t} onToggle={handleToggle} onDelete={remove} onClick={setSelectedTodo} />)}
            </div>
          </section>
        )}

        {!loading && todos.length === 0 && (
          <div className="text-center text-on-surface-variant py-20">
            <p className="text-lg mb-2">✨ 暂无待办</p>
            <p className="text-sm">点击「新建待办」开始记录吧</p>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedTodo && (
        <TodoDetailModal
          todo={selectedTodo}
          onClose={() => setSelectedTodo(null)}
          onSave={async (payload) => {
            await update(payload)
            setSelectedTodo(null)
          }}
        />
      )}
    </div>
  )
}
