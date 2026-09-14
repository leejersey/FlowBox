import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X, Calendar, Tag as TagIcon, Flag, Clock, Mic,
  Clipboard as ClipboardIcon, Link2, Trash2,
  CheckCircle2, Circle, Play, ArrowUpRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { DatePicker } from '@/components/ui/DatePicker'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { LinkPanel } from '@/components/links/LinkPanel'
import * as pomodoroService from '@/services/pomodoroService'
import { showToast } from '@/store/useToastStore'
import type { Todo, UpdateTodoPayload } from '@/types/todo'

interface TodoDetailPanelProps {
  todo: Todo
  onClose: () => void
  onUpdate: (payload: UpdateTodoPayload) => Promise<any>
  onDelete: (id: number) => Promise<any>
}

const priorityLabels: Record<number, string> = { 0: '无优先级', 1: '低优先级', 2: '中优先级', 3: '高优先级' }
const priorityColors: Record<number, string> = {
  0: 'bg-surface-container text-on-surface-variant hover:bg-surface-container-highest',
  1: 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 hover:bg-green-500/20',
  2: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20',
  3: 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20'
}

export function TodoDetailPanel({ todo, onClose, onUpdate, onDelete }: TodoDetailPanelProps) {
  const navigate = useNavigate()
  const [title, setTitle] = useState(todo.title)
  const [content, setContent] = useState(todo.content || '')
  const [priority, setPriority] = useState<0 | 1 | 2 | 3>(todo.priority)
  const [status, setStatus] = useState(todo.status)
  const [dueDate, setDueDate] = useState(todo.due_date || '')
  
  // 标签处理
  const initialTags: string[] = JSON.parse(todo.tags || '[]')
  const [tags, setTags] = useState<string[]>(initialTags)
  const [tagInput, setTagInput] = useState('')
  const [showLinks, setShowLinks] = useState(false)

  // 当外部传入的 todo 切换时，重置内部表单状态
  useEffect(() => {
    setTitle(todo.title)
    setContent(todo.content || '')
    setPriority(todo.priority)
    setStatus(todo.status)
    setDueDate(todo.due_date || '')
    try {
      setTags(JSON.parse(todo.tags || '[]'))
    } catch {
      setTags([])
    }
  }, [todo])

  // 自动同步更新
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const triggerUpdate = useCallback((partial: Partial<UpdateTodoPayload>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      onUpdate({
        id: todo.id,
        title: title.trim() || todo.title,
        content: content.trim(),
        priority,
        status,
        due_date: dueDate || null,
        tags,
        ...partial,
      })
    }, 300)
  }, [todo.id, todo.title, title, content, priority, status, dueDate, tags, onUpdate])

  // 状态快速翻转
  const handleToggleStatus = () => {
    const nextStatus = status === 'done' ? 'pending' : 'done'
    setStatus(nextStatus)
    triggerUpdate({ status: nextStatus })
  }

  // 优先级切换
  const handlePriorityChange = (p: 0 | 1 | 2 | 3) => {
    setPriority(p)
    triggerUpdate({ priority: p })
  }

  // 截止日期切换
  const handleDueDateChange = (date: string) => {
    setDueDate(date)
    triggerUpdate({ due_date: date || null })
  }

  // 添加标签
  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault()
      const newTag = tagInput.trim()
      if (!tags.includes(newTag)) {
        const nextTags = [...tags, newTag]
        setTags(nextTags)
        triggerUpdate({ tags: nextTags })
      }
      setTagInput('')
    }
  }

  // 移除标签
  const handleRemoveTag = (tagToRemove: string) => {
    const nextTags = tags.filter(t => t !== tagToRemove)
    setTags(nextTags)
    triggerUpdate({ tags: nextTags })
  }

  // 一键启动关联番茄钟
  const handleStartPomodoro = async () => {
    try {
      await pomodoroService.pomodoroStart({
        type: 'focus',
        duration_minutes: 25,
        related_todo_id: todo.id
      })
      showToast(`已开启 25min 专注番茄：${todo.title}`, 'success')
      navigate('/pomodoro')
    } catch (err) {
      showToast(`启动番茄钟失败: ${String(err)}`, 'error')
    }
  }

  return (
    <div className="h-full flex flex-col bg-surface-container/60 border border-outline-variant/30 rounded-3xl overflow-hidden backdrop-blur-xl animate-fade-in shadow-xl">
      {/* 顶部敏捷操作栏 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20 bg-surface/50 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleStatus}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer shadow-sm",
              status === 'done' 
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30" 
                : status === 'in_progress'
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                : "bg-surface-container-highest text-on-surface-variant hover:text-on-surface"
            )}
          >
            {status === 'done' ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>已完成</span>
              </>
            ) : (
              <>
                <Circle className="w-3.5 h-3.5 text-on-surface-variant/60" />
                <span>待处理</span>
              </>
            )}
          </button>

          <Button
            onClick={handleStartPomodoro}
            variant="secondary"
            size="sm"
            className="text-xs gap-1.5 hover:border-primary/40 hover:text-primary transition-all"
            title="一键为此任务开启 25min 专注番茄"
          >
            <Play className="w-3 h-3 text-primary fill-current" />
            <span>专注 25min</span>
          </Button>

          <span className="text-xs text-on-surface-variant/50 font-mono">#{todo.id}</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onDelete(todo.id)}
            className="p-2 text-on-surface-variant hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer"
            title="删除任务"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-xl transition-colors cursor-pointer"
            title="关闭详情面板"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 工作台主体编辑区 */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
        {/* 标题沉浸编辑 */}
        <div>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={() => triggerUpdate({ title })}
            placeholder="任务标题..."
            className="w-full text-2xl font-display font-bold bg-transparent text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none border-b border-transparent focus:border-outline-variant/30 pb-2 transition-colors"
          />
        </div>

        {/* 核心属性配置卡片 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* 优先级 */}
          <div className="bg-surface-container-low/80 rounded-2xl p-3 border border-outline-variant/20 flex flex-col gap-2">
            <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5 px-1">
              <Flag className="w-3.5 h-3.5 text-primary" /> 优先级
            </label>
            <div className="flex gap-1">
              {([0, 1, 2, 3] as const).map(p => (
                <button
                  key={p}
                  onClick={() => handlePriorityChange(p)}
                  className={cn(
                    "px-2 py-1 text-xs font-bold rounded-lg transition-all flex-1 cursor-pointer",
                    priority === p ? priorityColors[p] : "text-on-surface-variant/70 hover:bg-surface-container-highest"
                  )}
                >
                  {priorityLabels[p].replace('优先级', '')}
                </button>
              ))}
            </div>
          </div>

          {/* 截止日期 */}
          <div className="bg-surface-container-low/80 rounded-2xl p-3 border border-outline-variant/20 flex flex-col gap-2">
            <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5 px-1">
              <Calendar className="w-3.5 h-3.5 text-primary" /> 截止日期
            </label>
            <DatePicker
              value={dueDate}
              onChange={handleDueDateChange}
              placeholder="设置截止日期"
            />
          </div>
        </div>

        {/* 标签管理 */}
        <div className="bg-surface-container-low/80 rounded-2xl p-3.5 border border-outline-variant/20 flex flex-col gap-2">
          <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5 px-1">
            <TagIcon className="w-3.5 h-3.5 text-primary" /> 标签 (Enter 添加)
          </label>
          <div className="flex flex-wrap gap-1.5 items-center bg-surface-container rounded-xl p-2 min-h-[40px] border border-outline-variant/20">
            {tags.map(tag => (
              <Badge key={tag} variant="primary" size="sm" className="gap-1.5 py-1">
                <span>{tag}</span>
                <button onClick={() => handleRemoveTag(tag)} className="hover:text-red-400 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
            <input
              type="text"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder={tags.length === 0 ? "输入标签后按回车添加..." : "+ 添加标签"}
              className="flex-1 bg-transparent text-xs font-medium text-on-surface outline-none min-w-[90px] px-1 placeholder:text-on-surface-variant/40"
              maxLength={20}
            />
          </div>
        </div>

        {/* 详细描述与笔记区 */}
        <div className="flex flex-col gap-2 flex-1 min-h-[220px]">
          <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5 px-1">
            <Clock className="w-3.5 h-3.5 text-primary" /> 详细备忘与执行说明
          </label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            onBlur={() => triggerUpdate({ content })}
            placeholder="在此添加详细步骤、相关链接或任务备注（失焦自动保存）..."
            className="flex-1 w-full min-h-[200px] bg-surface-container-low/80 border border-outline-variant/20 focus:border-primary/40 rounded-2xl p-4 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none resize-none leading-relaxed transition-colors"
          />
        </div>

        {/* 数据溯源 */}
        {todo.source !== 'manual' && todo.source_id && (
          <div className="bg-surface-container-low/80 rounded-2xl p-3.5 border border-outline-variant/20">
            <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <Link2 className="w-3.5 h-3.5 text-primary" /> 来源溯源
            </label>
            <button
              onClick={() => {
                navigate(todo.source === 'voice' ? `/voice?highlight=voice-${todo.source_id}` : `/clipboard?highlight=clipboard-${todo.source_id}`)
              }}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer",
                todo.source === 'voice'
                  ? "bg-rose-500/10 text-rose-500 hover:bg-rose-500/20"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
              )}
            >
              {todo.source === 'voice' ? <Mic className="w-3.5 h-3.5" /> : <ClipboardIcon className="w-3.5 h-3.5" />}
              <span>{todo.source === 'voice' ? `来自语音备忘 #${todo.source_id}` : `来自剪贴板 #${todo.source_id}`}</span>
              <ArrowUpRight className="w-3 h-3 opacity-60" />
            </button>
          </div>
        )}

        {/* 关联管理器入口 */}
        <div className="bg-surface-container-low/80 rounded-2xl p-3.5 border border-outline-variant/20 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-on-surface">
            <Link2 className="w-3.5 h-3.5 text-primary" />
            <span>任务关联知识与文档</span>
          </div>
          <Button onClick={() => setShowLinks(true)} variant="outline" size="sm">
            管理关联
          </Button>
        </div>
      </div>

      {showLinks && <LinkPanel type="todo" id={todo.id} onClose={() => setShowLinks(false)} />}
    </div>
  )
}
