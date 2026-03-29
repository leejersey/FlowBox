import { useState, useEffect } from 'react'
import { Sparkles, Mic, Clipboard as ClipboardIcon, MoreHorizontal, Archive, Trash2, Tag, X, Check, Calendar, ExternalLink, Edit2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Idea } from '@/types/idea'
import { useIdeas } from '@/hooks/useIdeas'

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const d = new Date(dateStr).getTime()
  const diff = now - d
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}天前`
  return dateStr.slice(0, 10)
}

function IdeaCard({
  idea,
  onArchive,
  onDelete,
  onUpdateTags,
  onClick
}: {
  idea: Idea
  onArchive: (id: number) => void
  onDelete: (id: number) => void
  onUpdateTags: (id: number, tags: string[]) => void
  onClick: (idea: Idea) => void
}) {
  const [showMenu, setShowMenu] = useState(false)
  const [isEditingTags, setIsEditingTags] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [currentTags, setCurrentTags] = useState<string[]>([])

  // Parse tags safely
  useEffect(() => {
    try {
      setCurrentTags(JSON.parse(idea.tags || '[]'))
    } catch {
      setCurrentTags([])
    }
  }, [idea.tags])

  const handleAddTag = () => {
    const trimmed = tagInput.trim()
    if (!trimmed) return
    if (!currentTags.includes(trimmed)) {
      const newTags = [...currentTags, trimmed]
      setCurrentTags(newTags)
      onUpdateTags(idea.id, newTags)
    }
    setTagInput('')
  }

  const handleRemoveTag = (tagToRemove: string) => {
    const newTags = currentTags.filter(t => t !== tagToRemove)
    setCurrentTags(newTags)
    onUpdateTags(idea.id, newTags)
  }

  return (
    <div
      className="group relative bg-surface-container hover:bg-surface-container-highest transition-all duration-300 rounded-3xl p-5 break-inside-avoid mb-6 flex flex-col shadow-sm border border-transparent hover:border-white/10 hover:shadow-md cursor-pointer"
      onClick={() => onClick(idea)}
    >
      <p className="text-on-surface text-[15px] leading-relaxed mb-4 flex-1 whitespace-pre-wrap line-clamp-6">
        {idea.content}
      </p>

      {/* Tags Area */}
      {isEditingTags ? (
        <div className="mb-4 bg-surface-container-highest p-3 rounded-xl border border-white/10">
          <div className="flex flex-wrap gap-2 mb-2">
            {currentTags.map(tag => (
              <span key={tag} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md font-medium bg-primary/20 text-primary">
                {tag}
                <X className="w-3 h-3 cursor-pointer hover:text-white transition-colors" onClick={() => handleRemoveTag(tag)} />
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              autoFocus
              className="flex-1 bg-surface-container text-xs px-3 py-1.5 rounded-lg outline-none text-on-surface placeholder:text-on-surface-variant/50"
              placeholder="输入新标签并回车..."
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddTag()
                } else if (e.key === 'Escape') {
                  setIsEditingTags(false)
                }
              }}
            />
            <button
              onClick={() => {
                if (tagInput.trim()) handleAddTag()
                setIsEditingTags(false)
              }}
              className="p-1.5 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        currentTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {currentTags.map(tag => (
              <span key={tag} className={cn(
                "text-xs px-2.5 py-1 rounded-md font-medium bg-surface-container-highest text-on-surface-variant",
                tag.includes('技术') ? "bg-teal-500/10 text-teal-600" :
                tag.includes('内容') ? "bg-rose-500/10 text-rose-600" :
                "bg-primary/10 text-primary"
              )}>
                {tag}
              </span>
            ))}
          </div>
        )
      )}

      {/* Footer Meta */}
      <div className="flex items-center justify-between mt-auto">
        <div className="flex items-center gap-2 text-on-surface-variant shrink-0">
          {idea.source === 'voice' && <Mic className="w-3.5 h-3.5" />}
          {idea.source === 'clipboard' && <ClipboardIcon className="w-3.5 h-3.5" />}
          <span className="text-xs font-medium opacity-70">{timeAgo(idea.created_at)}</span>
        </div>
      </div>

      {/* Floating Menu */}
      <div className="absolute top-4 right-4 text-left" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          onBlur={() => setTimeout(() => setShowMenu(false), 200)}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-black/5 transition-all text-on-surface-variant"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
        {showMenu && (
          <div className="absolute right-0 top-8 bg-surface rounded-xl shadow-lg border border-white/20 py-1 z-50 min-w-[120px]">
            <button
              onClick={() => { setIsEditingTags(true); setShowMenu(false) }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-on-surface hover:bg-surface-container transition-colors"
            >
              <Tag className="w-3.5 h-3.5" /> 编辑标签
            </button>
            <button
              onClick={() => { onArchive(idea.id); setShowMenu(false) }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-on-surface hover:bg-surface-container transition-colors"
            >
              <Archive className="w-3.5 h-3.5" /> 归档
            </button>
            <button
              onClick={() => { onDelete(idea.id); setShowMenu(false) }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-500/5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> 删除
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Detail Modal ───────────────────────────────────── */
function IdeaDetailModal({ idea, onClose, onUpdate }: { idea: Idea; onClose: () => void; onUpdate: (id: number, data: {content: string}) => Promise<void> }) {
  let tags: string[] = []
  try { tags = JSON.parse(idea.tags || '[]') } catch { /* ignore */ }

  const [isEditing, setIsEditing] = useState(false)
  const [content, setContent] = useState(idea.content)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSave = async () => {
    if (!content.trim() || content === idea.content) {
      setIsEditing(false)
      return
    }
    setSaving(true)
    await onUpdate(idea.id, { content: content.trim() })
    setSaving(false)
    setIsEditing(false)
  }

  const sourceLabel = idea.source === 'voice' ? '语音录入' : idea.source === 'clipboard' ? '剪贴板捕获' : '手动输入'
  const sourceIcon = idea.source === 'voice' ? <Mic className="w-3.5 h-3.5" /> : idea.source === 'clipboard' ? <ClipboardIcon className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative z-10 bg-surface rounded-3xl w-full max-w-xl max-h-[80vh] flex flex-col shadow-[0_32px_80px_-20px_rgba(0,0,0,0.4)] border border-white/20 animate-slide-up overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-surface-container-highest shrink-0">
          <h2 className="text-lg font-display font-bold text-on-surface">灵感详情</h2>
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <button title="编辑灵感" onClick={() => setIsEditing(true)} className="p-1.5 rounded-lg hover:bg-surface-container-highest text-on-surface-variant hover:text-primary transition-colors cursor-pointer">
                <Edit2 className="w-5 h-5" />
              </button>
            ) : (
              <button disabled={saving} title="保存更改" onClick={handleSave} className="p-1.5 rounded-lg hover:bg-surface-container-highest text-primary transition-colors disabled:opacity-50 cursor-pointer">
                <Check className="w-5 h-5" />
              </button>
            )}
            <button title="关闭" onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-container-highest text-on-surface-variant transition-colors cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-7 py-6">
          {isEditing ? (
            <textarea
              autoFocus
              value={content}
              onChange={e => setContent(e.target.value)}
              className="w-full min-h-[150px] bg-surface-container-low border border-transparent focus:border-primary/20 rounded-2xl p-4 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none resize-none leading-relaxed transition-all"
            />
          ) : (
            <p className="text-on-surface text-[15px] leading-relaxed whitespace-pre-wrap">{content}</p>
          )}

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-6">
              {tags.map(tag => (
                <span key={tag} className={cn(
                  "text-xs px-3 py-1.5 rounded-lg font-medium",
                  tag.includes('技术') ? "bg-teal-500/10 text-teal-600" :
                  tag.includes('内容') ? "bg-rose-500/10 text-rose-600" :
                  "bg-primary/10 text-primary"
                )}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Footer Meta */}
        <div className="flex items-center gap-5 px-7 py-4 border-t border-surface-container-highest text-xs text-on-surface-variant font-medium shrink-0">
          <span className="flex items-center gap-1.5">
            {sourceIcon}
            {sourceLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {new Date(idea.created_at).toLocaleString('zh-CN')}
          </span>
        </div>
      </div>
    </div>
  )
}

/* ─── Main Page ──────────────────────────────────────── */
export function IdeaPage() {
  const { ideas, loading, createIdea, archiveIdea, deleteIdea, updateIdea } = useIdeas()
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null)

  const [newContent, setNewContent] = useState('')
  const [newTags, setNewTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')

  const handleSave = async () => {
    if (!newContent.trim()) return
    await createIdea(newContent.trim(), newTags)
    setNewContent('')
    setNewTags([])
    setTagInput('')
  }

  const handleAddNewTag = () => {
    const trimmed = tagInput.trim()
    if (!trimmed) return
    if (!newTags.includes(trimmed)) {
      setNewTags([...newTags, trimmed])
    }
    setTagInput('')
  }

  const handleRemoveNewTag = (tagToRemove: string) => {
    setNewTags(newTags.filter(t => t !== tagToRemove))
  }

  const handleUpdateTags = (id: number, updatedTags: string[]) => {
    updateIdea(id, { tags: updatedTags })
  }

  return (
    <div className="flex flex-col h-full animate-fade-in w-full max-w-5xl mx-auto overflow-y-auto overflow-x-hidden pb-10">
      {/* Input Area */}
      <div className="bg-surface-container-low rounded-3xl p-6 mb-10 shadow-sm border border-white/40 relative z-20 transition-all focus-within:ring-2 focus-within:ring-primary/20">
        <textarea
          placeholder="记录你的灵感..."
          value={newContent}
          onChange={e => setNewContent(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleSave() }}
          className="w-full bg-transparent resize-none outline-none text-lg text-on-surface placeholder:text-on-surface-variant/50 min-h-[80px]"
        />

        {/* New Item Tags Builder */}
        <div className="flex flex-wrap items-center gap-2 mt-2 mb-4">
          {newTags.map(tag => (
            <span key={tag} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-medium bg-primary/10 text-primary border border-primary/20">
              {tag}
              <X className="w-3 h-3 cursor-pointer hover:text-primary-dark transition-colors" onClick={() => handleRemoveNewTag(tag)} />
            </span>
          ))}
          <div className="flex items-center gap-2">
            <div className="relative flex items-center">
              <Tag className="absolute left-2.5 w-3.5 h-3.5 text-on-surface-variant/50" />
              <input
                type="text"
                placeholder="添加标签..."
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddNewTag()
                  } else if (e.key === 'Escape' || (e.key === 'Backspace' && tagInput === '')) {
                    if (newTags.length > 0 && tagInput === '') {
                      // backspace deletes last tag if input is empty
                      handleRemoveNewTag(newTags[newTags.length - 1])
                    }
                  }
                }}
                className="bg-surface-container pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none text-on-surface placeholder:text-on-surface-variant/50 focus:bg-surface-container-highest transition-colors w-32 focus:w-48"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/10 pt-4">
          <span className="text-xs text-on-surface-variant font-medium flex items-center gap-2">
            <kbd className="bg-surface-container px-2 py-1 rounded text-[10px] font-mono border border-white/10">⌘ Enter</kbd>
            快速保存
          </span>
          <button
            onClick={handleSave}
            disabled={!newContent.trim()}
            className="primary-gradient-button px-6 py-2.5 rounded-full font-bold text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-lg hover:shadow-primary/25"
          >
            保存灵感
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-display font-bold text-on-surface flex items-center gap-3">
          最近灵感库
          {!loading && ideas.length > 0 && (
            <span className="text-xs font-bold text-on-surface bg-surface-container-highest px-3 py-1 rounded-full">{ideas.length} 条</span>
          )}
        </h2>
      </div>

      <div className="columns-1 md:columns-2 lg:columns-3 gap-6 relative">
        {ideas.length >= 3 && (
          <div className="relative p-[1px] rounded-3xl mb-6 break-inside-avoid shadow-lg group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary to-purple-500 rounded-3xl opacity-20 blur-sm group-hover:opacity-30 transition-opacity" />
            <div className="relative bg-surface rounded-[23px] p-6 border border-primary/20">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-primary" />
                <h3 className="font-display font-bold text-primary">AI 灵感周报</h3>
              </div>
              <p className="text-sm text-on-surface-variant leading-relaxed mb-4">
                你已记录 {ideas.length} 条灵感，继续保持创意输出！
              </p>
            </div>
          </div>
        )}

        {ideas.map(idea => (
          <IdeaCard
            key={idea.id}
            idea={idea}
            onArchive={archiveIdea}
            onDelete={deleteIdea}
            onUpdateTags={handleUpdateTags}
            onClick={setSelectedIdea}
          />
        ))}
      </div>

      {ideas.length === 0 && !loading && (
        <div className="text-center text-on-surface-variant py-20 bg-surface-container-low rounded-3xl border border-dashed border-on-surface-variant/20">
          <Sparkles className="w-12 h-12 mx-auto mb-4 text-primary/40" />
          <p className="text-lg mb-2 font-display font-bold text-on-surface">灵感库为空</p>
          <p className="text-sm">在上方输入框记录你的第一个灵感并打上标签吧</p>
        </div>
      )}

      {/* Detail Modal */}
      {selectedIdea && (
        <IdeaDetailModal 
          idea={selectedIdea} 
          onClose={() => setSelectedIdea(null)} 
          onUpdate={updateIdea}
        />
      )}
    </div>
  )
}
