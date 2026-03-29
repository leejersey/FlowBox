import { useState, useEffect } from 'react'
import { X, Calendar, Tag as TagIcon, Flag, Clock, Mic, Clipboard as ClipboardIcon, Link2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DatePicker } from '@/components/ui/DatePicker'
import type { Todo, UpdateTodoPayload } from '@/types/todo'

interface TodoDetailModalProps {
  todo: Todo
  onClose: () => void
  onSave: (payload: UpdateTodoPayload) => Promise<void>
}

const priorityLabels: Record<number, string> = { 0: '无优先级', 1: '低优先级', 2: '中优先级', 3: '高优先级' }
const priorityColors: Record<number, string> = {
  0: 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high', 
  1: 'bg-green-500/10 text-green-600 hover:bg-green-500/20', 
  2: 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20', 
  3: 'bg-red-500/10 text-red-600 hover:bg-red-500/20'
}

export function TodoDetailModal({ todo, onClose, onSave }: TodoDetailModalProps) {
  const [title, setTitle] = useState(todo.title)
  const [content, setContent] = useState(todo.content || '')
  const [priority, setPriority] = useState<0 | 1 | 2 | 3>(todo.priority)
  const [status, setStatus] = useState(todo.status)
  const [dueDate, setDueDate] = useState(todo.due_date || '')
  
  // Tags handling
  const initialTags: string[] = JSON.parse(todo.tags || '[]')
  const [tags, setTags] = useState<string[]>(initialTags)
  const [tagInput, setTagInput] = useState('')

  const [saving, setSaving] = useState(false)

  // Prevent background scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = 'auto' }
  }, [])

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      await onSave({
        id: todo.id,
        title: title.trim(),
        content: content.trim(),
        priority,
        status,
        due_date: dueDate || null,
        tags
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault()
      const newTag = tagInput.trim()
      if (!tags.includes(newTag)) {
        setTags([...tags, newTag])
      }
      setTagInput('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface border border-white/20 shadow-2xl rounded-3xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-container-highest">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setStatus(status === 'done' ? 'pending' : 'done')}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold transition-colors",
                status === 'done' ? "bg-primary text-white" : 
                status === 'in_progress' ? "bg-amber-500/10 text-amber-600" :
                "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
              )}
            >
              {status === 'done' ? '✅ 已完成' : status === 'in_progress' ? '⏳ 进行中' : '⬜ 待处理'}
            </button>
            <span className="text-xs text-on-surface-variant font-medium">#{todo.id}</span>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Title */}
          <div>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="待办标题"
              className="w-full text-2xl font-display font-bold bg-transparent text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none"
            />
          </div>

          {/* Properties Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Priority */}
            <div className="bg-surface-container-low rounded-2xl p-3 flex flex-col gap-2 border border-transparent focus-within:border-primary/20">
              <label className="text-xs font-bold text-on-surface-variant flex items-center gap-1.5 px-1">
                <Flag className="w-3.5 h-3.5" /> 优先级
              </label>
              <div className="flex gap-1 flex-wrap">
                {([0, 1, 2, 3] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={cn(
                      "px-2.5 py-1 text-xs font-bold rounded-lg transition-colors flex-1",
                      priority === p ? priorityColors[p] : "text-on-surface-variant hover:bg-surface-container-high"
                    )}
                  >
                    {priorityLabels[p].replace('优先级', '')}
                  </button>
                ))}
              </div>
            </div>

            {/* Status Explicit */}
            <div className="bg-surface-container-low rounded-2xl p-3 flex flex-col gap-2 border border-transparent focus-within:border-primary/20">
              <label className="text-xs font-bold text-on-surface-variant flex items-center gap-1.5 px-1">
                <Clock className="w-3.5 h-3.5" /> 进度状态
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as typeof status)}
                className="bg-surface-container text-sm font-medium text-on-surface rounded-xl px-3 py-1.5 outline-none appearance-none"
              >
                <option value="pending">待处理</option>
                <option value="in_progress">进行中</option>
                <option value="done">已完成</option>
              </select>
            </div>

            {/* Due Date */}
            <div className="bg-surface-container-low rounded-2xl p-3 flex flex-col gap-2 border border-transparent focus-within:border-primary/20">
              <label className="text-xs font-bold text-on-surface-variant flex items-center gap-1.5 px-1">
                <Calendar className="w-3.5 h-3.5" /> 截止日期
              </label>
              <DatePicker
                value={dueDate || ''}
                onChange={setDueDate}
                placeholder="设置截止日期"
              />
            </div>

            {/* Tags */}
            <div className="bg-surface-container-low rounded-2xl p-3 flex flex-col gap-2 border border-transparent focus-within:border-primary/20">
              <label className="text-xs font-bold text-on-surface-variant flex items-center gap-1.5 px-1">
                <TagIcon className="w-3.5 h-3.5" /> 标签 (回车添加)
              </label>
              <div className="flex flex-wrap gap-1.5 items-center bg-surface-container rounded-xl p-1.5 min-h-[36px]">
                {tags.map(tag => (
                  <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-xs font-bold rounded-md">
                    {tag}
                    <button onClick={() => handleRemoveTag(tag)} className="hover:text-primary-variant"><X className="w-3 h-3" /></button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={handleAddTag}
                  placeholder={tags.length === 0 ? "添加标签..." : ""}
                  className="flex-1 bg-transparent text-xs font-medium text-on-surface outline-none min-w-[60px] px-1 placeholder:text-on-surface-variant/50"
                  maxLength={20}
                />
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex flex-col gap-2 h-48">
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="添加详细描述..."
              className="flex-1 w-full bg-surface-container-low border border-transparent focus:border-primary/20 rounded-2xl p-4 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none resize-none leading-relaxed"
            />
          </div>

          {/* Source Tracing */}
          {todo.source !== 'manual' && todo.source_id && (
            <div className="bg-surface-container-low rounded-2xl p-3 border border-transparent">
              <label className="text-xs font-bold text-on-surface-variant flex items-center gap-1.5 px-1 mb-2">
                <Link2 className="w-3.5 h-3.5" /> 数据来源
              </label>
              <a
                href={todo.source === 'voice' ? `/voice?highlight=voice-${todo.source_id}` : `/clipboard?highlight=clipboard-${todo.source_id}`}
                className={cn(
                  "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors",
                  todo.source === 'voice'
                    ? "bg-rose-500/10 text-rose-500 hover:bg-rose-500/20"
                    : "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                )}
              >
                {todo.source === 'voice' ? <Mic className="w-3.5 h-3.5" /> : <ClipboardIcon className="w-3.5 h-3.5" />}
                {todo.source === 'voice' ? `语音备忘 #${todo.source_id}` : `剪贴板 #${todo.source_id}`}
                <span className="text-[10px] opacity-60">点击跳转 →</span>
              </a>
            </div>
          )}
          
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-surface-container-low border-t border-surface-container-highest">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            取消
          </button>
          <button 
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="primary-gradient-button px-6 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? '保存中...' : '保存更改'}
          </button>
        </div>

      </div>
    </div>
  )
}
