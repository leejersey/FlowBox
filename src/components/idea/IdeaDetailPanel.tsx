import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X, CheckSquare, Trash2, Archive, Link2, Tag, Copy, Check,
  Clock, ArrowUpRight, Sparkles, Mic, Clipboard as ClipboardIcon
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { LinkPanel } from '@/components/links/LinkPanel'
import { todoCreate } from '@/services/todoService'
import { showToast } from '@/store/useToastStore'
import { playCopySuccessSound } from '@/lib/soundEffects'
import type { Idea } from '@/types/idea'

interface IdeaDetailPanelProps {
  idea: Idea
  onClose: () => void
  onUpdate: (id: number, data: { content?: string; tags?: string[] }) => Promise<void> | void
  onDelete: (id: number) => Promise<void> | void
  onArchive: (id: number) => Promise<void> | void
}

function parseIdeaTags(tags: string | null): string[] {
  try {
    return JSON.parse(tags || '[]')
  } catch {
    return []
  }
}

export function IdeaDetailPanel({
  idea,
  onClose,
  onUpdate,
  onDelete,
  onArchive,
}: IdeaDetailPanelProps) {
  const navigate = useNavigate()
  const [content, setContent] = useState(idea.content)
  const [tags, setTags] = useState<string[]>(() => parseIdeaTags(idea.tags))
  const [tagInput, setTagInput] = useState('')
  const [copied, setCopied] = useState(false)
  const [showLinks, setShowLinks] = useState(false)
  const [converting, setConverting] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setContent(idea.content)
    setTags(parseIdeaTags(idea.tags))
  }, [idea])

  const triggerAutoSave = useCallback((newContent: string, newTags: string[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      onUpdate(idea.id, {
        content: newContent.trim(),
        tags: newTags,
      })
    }, 350)
  }, [idea.id, onUpdate])

  const handleContentChange = (val: string) => {
    setContent(val)
    triggerAutoSave(val, tags)
  }

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault()
      const newTag = tagInput.trim()
      if (!tags.includes(newTag)) {
        const nextTags = [...tags, newTag]
        setTags(nextTags)
        triggerAutoSave(content, nextTags)
      }
      setTagInput('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    const nextTags = tags.filter(t => t !== tagToRemove)
    setTags(nextTags)
    triggerAutoSave(content, nextTags)
  }

  const handleCopyContent = async () => {
    try {
      await navigator.clipboard.writeText(content)
      playCopySuccessSound()
      setCopied(true)
      showToast('灵感内容已复制', 'success')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showToast('复制失败', 'error')
    }
  }

  const handleConvertToTodo = async () => {
    try {
      setConverting(true)
      const lines = content.split('\n').filter(Boolean)
      const title = (lines[0] || '灵感任务').slice(0, 60)
      const detail = lines.slice(1).join('\n').trim()

      const newTodo = await todoCreate({
        title,
        content: detail || content,
        priority: 1,
        source: 'manual',
        tags: tags.length > 0 ? tags : ['灵感转化'],
      })

      showToast('已成功转化为待办任务！', 'success')
      navigate(`/?highlight=todo-${newTodo.id}`)
    } catch (err) {
      showToast(`转化失败: ${String(err)}`, 'error')
    } finally {
      setConverting(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-surface-container/60 border border-outline-variant/30 rounded-3xl overflow-hidden backdrop-blur-xl animate-fade-in shadow-xl">
      {/* 顶部敏捷操作栏 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20 bg-surface/50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-xs">
            <Sparkles className="w-3.5 h-3.5" />
            <span>灵感便签</span>
          </div>

          {/* 转为待办按钮 */}
          <Button
            onClick={handleConvertToTodo}
            disabled={converting}
            variant="secondary"
            size="sm"
            className="text-xs gap-1.5 hover:border-primary/40 hover:text-primary transition-all cursor-pointer"
            title="将此灵感沉淀为待办事项"
          >
            <CheckSquare className="w-3.5 h-3.5 text-primary" />
            <span>转为待办</span>
          </Button>

          <span className="text-xs text-on-surface-variant/50 font-mono">#{idea.id}</span>
        </div>

        {/* 右侧操作按钮组 */}
        <div className="flex items-center gap-1.5">
          {/* 复制 */}
          <button
            onClick={handleCopyContent}
            className={cn(
              "p-2 rounded-xl transition-all cursor-pointer flex items-center gap-1 text-xs font-medium",
              copied
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest"
            )}
            title="复制文本"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>

          {/* 归档 */}
          <button
            onClick={() => onArchive(idea.id)}
            className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-xl transition-colors cursor-pointer"
            title="归档此灵感"
          >
            <Archive className="w-4 h-4" />
          </button>

          {/* 删除 */}
          <button
            onClick={() => onDelete(idea.id)}
            className="p-2 text-on-surface-variant hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer"
            title="删除灵感"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* 关闭 */}
          <button
            onClick={onClose}
            className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-xl transition-colors cursor-pointer"
            title="关闭工作台 (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 工作台主体 */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
        {/* 元信息条 */}
        <div className="flex items-center justify-between text-xs text-on-surface-variant bg-surface-container-low/70 px-4 py-2.5 rounded-2xl border border-outline-variant/20">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            <span>记录于：{new Date(idea.created_at).toLocaleString('zh-CN')}</span>
          </div>

          <div className="flex items-center gap-3">
            <span>共 {content.length} 字符</span>
          </div>
        </div>

        {/* 标签管理区 */}
        <div className="bg-surface-container-low/80 rounded-2xl p-3.5 border border-outline-variant/20 flex flex-col gap-2">
          <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5 px-1">
            <Tag className="w-3.5 h-3.5 text-primary" /> 分类标签 (Enter 添加)
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

        {/* 沉浸式文本/Markdown 编辑区 */}
        <div className="flex flex-col gap-2 flex-1 min-h-[260px]">
          <div className="flex items-center justify-between px-1">
            <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
              灵感备忘内容 (失焦自动保存)
            </label>
            <span className="text-[10px] text-on-surface-variant/60 font-mono">Markdown 支持</span>
          </div>
          <textarea
            value={content}
            onChange={e => handleContentChange(e.target.value)}
            onBlur={() => onUpdate(idea.id, { content: content.trim(), tags })}
            placeholder="写下你的突发奇想、设计思路或知识草稿..."
            className="flex-1 w-full min-h-[250px] bg-surface-container-low/80 border border-outline-variant/20 focus:border-primary/40 rounded-2xl p-5 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none resize-none leading-relaxed transition-colors select-text"
          />
        </div>

        {/* 数据溯源 */}
        {idea.source !== 'manual' && idea.source_id && (
          <div className="bg-surface-container-low/80 rounded-2xl p-3.5 border border-outline-variant/20">
            <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <Link2 className="w-3.5 h-3.5 text-primary" /> 灵感来源
            </label>
            <button
              onClick={() => {
                navigate(idea.source === 'voice' ? `/voice?highlight=voice-${idea.source_id}` : `/clipboard?highlight=clipboard-${idea.source_id}`)
              }}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer",
                idea.source === 'voice'
                  ? "bg-rose-500/10 text-rose-500 hover:bg-rose-500/20"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
              )}
            >
              {idea.source === 'voice' ? <Mic className="w-3.5 h-3.5" /> : <ClipboardIcon className="w-3.5 h-3.5" />}
              <span>{idea.source === 'voice' ? `来自语音速记 #${idea.source_id}` : `来自剪贴历史 #${idea.source_id}`}</span>
              <ArrowUpRight className="w-3 h-3 opacity-60" />
            </button>
          </div>
        )}

        {/* 关联管理器入口 */}
        <div className="bg-surface-container-low/80 rounded-2xl p-4 border border-outline-variant/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-xs font-bold text-on-surface">
            <Link2 className="w-4 h-4 text-primary" />
            <span>关联待办、语音与剪贴板</span>
          </div>
          <Button onClick={() => setShowLinks(true)} variant="outline" size="sm" className="text-xs">
            管理关联
          </Button>
        </div>
      </div>

      {showLinks && <LinkPanel type="idea" id={idea.id} onClose={() => setShowLinks(false)} />}
    </div>
  )
}
