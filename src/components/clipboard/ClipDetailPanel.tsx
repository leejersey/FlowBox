import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X, Pin, Copy, Check, Trash2, Clock, Code2, Type, Image as ImageIcon,
  CheckSquare, Link2, Bot, ArrowUpRight, ExternalLink, Maximize2
} from 'lucide-react'
import { convertFileSrc, isTauri } from '@tauri-apps/api/core'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { LinkPanel } from '@/components/links/LinkPanel'
import { showToast } from '@/store/useToastStore'
import { todoCreate } from '@/services/todoService'
import type { ClipboardItem } from '@/types/clipboard'
import { playCopySuccessSound } from '@/lib/soundEffects'

const isTauriApp = isTauri()

function resolveImageSrc(imagePath: string | null): string | null {
  if (!imagePath) return null
  if (imagePath.startsWith('data:') || imagePath.startsWith('file://')) return imagePath
  return isTauriApp ? convertFileSrc(imagePath) : imagePath
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  return `${Math.floor(hours / 24)} 天前`
}

interface ClipDetailPanelProps {
  clip: ClipboardItem
  onClose: () => void
  onPin: (id: number) => Promise<void> | void
  onDelete: (id: number) => Promise<void> | void
  onCopy: (clip: ClipboardItem) => void
  onImageClick?: (src: string) => void
}

export function ClipDetailPanel({
  clip,
  onClose,
  onPin,
  onDelete,
  onCopy,
  onImageClick,
}: ClipDetailPanelProps) {
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const [copiedOcr, setCopiedOcr] = useState(false)
  const [showLinks, setShowLinks] = useState(false)
  const [convertingTodo, setConvertingTodo] = useState(false)

  const imageSrc = resolveImageSrc(clip.image_path)
  const isPinned = clip.is_pinned === 1

  const handleCopy = () => {
    onCopy(clip)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCopyOcr = async () => {
    if (!clip.ocr_text) return
    try {
      await navigator.clipboard.writeText(clip.ocr_text)
      playCopySuccessSound()
      setCopiedOcr(true)
      showToast('OCR 识别文本已复制', 'success')
      setTimeout(() => setCopiedOcr(false), 2000)
    } catch {
      showToast('复制失败', 'error')
    }
  }

  // 一键转为待办任务
  const handleConvertToTodo = async () => {
    try {
      setConvertingTodo(true)
      const rawText = clip.text_content || clip.ocr_text || '剪贴板捕获任务'
      const title = rawText.split('\n')[0].trim().slice(0, 60) || '剪贴板捕获任务'
      const content = rawText.length > title.length ? rawText : ''
      
      const newTodo = await todoCreate({
        title,
        content,
        priority: 1,
        source: 'clipboard',
        source_id: clip.id,
        tags: clip.category ? [clip.category] : ['剪贴板'],
      })

      showToast('已成功转化为待办任务！', 'success')
      navigate(`/?highlight=todo-${newTodo.id}`)
    } catch (err) {
      showToast(`转化失败: ${String(err)}`, 'error')
    } finally {
      setConvertingTodo(false)
    }
  }

  // 提取文本中的潜在 URL
  const urls = (clip.text_content || '').match(/https?:\/\/[^\s$.?#].[^\s]*/g) || []

  return (
    <div className="h-full flex flex-col bg-surface-container/60 border border-outline-variant/30 rounded-3xl overflow-hidden backdrop-blur-xl animate-fade-in shadow-xl">
      {/* 顶部敏捷操作栏 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20 bg-surface/50 shrink-0">
        <div className="flex items-center gap-3">
          {/* 类型图标徽标 */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-surface-container-highest text-on-surface shadow-xs">
            {clip.content_type === 'text' && <Type className="w-3.5 h-3.5 text-primary" />}
            {clip.content_type === 'code' && <Code2 className="w-3.5 h-3.5 text-violet-500" />}
            {clip.content_type === 'image' && <ImageIcon className="w-3.5 h-3.5 text-blue-500" />}
            <span>{clip.content_type === 'text' ? '文本' : clip.content_type === 'code' ? '代码' : '图片'}</span>
          </div>

          {/* 分类标签 */}
          {clip.category && (
            <span className={cn(
              "text-xs font-bold px-2.5 py-1 rounded-full",
              clip.category === '代码' && "bg-violet-500/15 text-violet-600 dark:text-violet-400",
              clip.category === '文档' && "bg-blue-500/15 text-blue-600 dark:text-blue-400",
              clip.category === '链接' && "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
              clip.category === '命令' && "bg-orange-500/15 text-orange-600 dark:text-orange-400",
              clip.category === '笔记' && "bg-green-500/15 text-green-600 dark:text-green-400",
              clip.category === '数据' && "bg-amber-500/15 text-amber-600 dark:text-amber-400",
              !['代码','文档','链接','命令','笔记','数据'].includes(clip.category) && "bg-surface-container border border-outline-variant/30 text-on-surface-variant",
            )}>
              {clip.category}
            </span>
          )}

          {/* 转为待办按钮 */}
          <Button
            onClick={handleConvertToTodo}
            disabled={convertingTodo}
            variant="secondary"
            size="sm"
            className="text-xs gap-1.5 hover:border-primary/40 hover:text-primary transition-all cursor-pointer"
            title="将此剪贴板内容直接创建为 Todo 任务"
          >
            <CheckSquare className="w-3.5 h-3.5 text-primary" />
            <span>转为待办</span>
          </Button>

          <span className="text-xs text-on-surface-variant/50 font-mono">#{clip.id}</span>
        </div>

        {/* 右侧操作按钮组 */}
        <div className="flex items-center gap-1.5">
          {/* 复制 */}
          <button
            onClick={handleCopy}
            className={cn(
              "p-2 rounded-xl transition-all cursor-pointer flex items-center gap-1 text-xs font-medium",
              copied
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest"
            )}
            title="复制到剪贴板"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            {copied && <span>已复制</span>}
          </button>

          {/* 置顶 */}
          <button
            onClick={() => onPin(clip.id)}
            className={cn(
              "p-2 rounded-xl transition-colors cursor-pointer",
              isPinned
                ? "bg-primary/15 text-primary"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
            )}
            title={isPinned ? "取消置顶" : "置顶条目"}
          >
            <Pin className={cn("w-4 h-4", isPinned && "fill-current")} />
          </button>

          {/* 删除 */}
          <button
            onClick={() => onDelete(clip.id)}
            className="p-2 text-on-surface-variant hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer"
            title="删除此记录"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* 关闭 */}
          <button
            onClick={onClose}
            className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-xl transition-colors cursor-pointer"
            title="关闭详情面板"
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
            <span>捕获时间：{new Date(clip.created_at).toLocaleString('zh-CN')}</span>
            <span className="text-on-surface-variant/40">•</span>
            <span>{timeAgo(clip.created_at)}</span>
          </div>

          <div className="flex items-center gap-3">
            {clip.text_content && (
              <span>共 {clip.text_content.length} 字符 / {clip.text_content.split('\n').length} 行</span>
            )}
            {clip.ocr_text && (
              <span className="text-primary font-medium">包含 OCR 识别数据</span>
            )}
          </div>
        </div>

        {/* 提取的 URL 快捷跳转 */}
        {urls.length > 0 && (
          <div className="bg-surface-container-low/80 p-3.5 rounded-2xl border border-outline-variant/20 flex flex-col gap-2">
            <div className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
              <ExternalLink className="w-3.5 h-3.5 text-primary" /> 包含的链接
            </div>
            <div className="flex flex-col gap-1.5">
              {urls.map((u, idx) => (
                <a
                  key={idx}
                  href={u}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1 truncate font-mono"
                >
                  <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{u}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* 内容展示区 */}
        {clip.content_type === 'text' && (
          <div className="bg-surface-container-low/90 rounded-2xl p-5 border border-outline-variant/20">
            <p className="text-[15px] leading-relaxed text-on-surface whitespace-pre-wrap select-text font-normal">
              {clip.text_content}
            </p>
          </div>
        )}

        {clip.content_type === 'code' && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-mono text-on-surface-variant px-1">
              <span>代码预览</span>
              <button
                onClick={handleCopy}
                className="hover:text-primary transition-colors cursor-pointer flex items-center gap-1"
              >
                <Copy className="w-3 h-3" />
                <span>复制代码</span>
              </button>
            </div>
            <pre className="bg-surface-container-highest/90 p-5 rounded-2xl text-sm font-mono text-on-surface overflow-x-auto border border-outline-variant/20 shadow-inner select-text leading-relaxed">
              <code>{clip.text_content}</code>
            </pre>
          </div>
        )}

        {clip.content_type === 'image' && (
          <div className="flex flex-col gap-5">
            {imageSrc ? (
              <div
                onClick={() => onImageClick && onImageClick(imageSrc)}
                className="relative group/img overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-highest cursor-zoom-in max-h-[380px] flex items-center justify-center shadow-md"
              >
                <img
                  src={imageSrc}
                  alt="剪贴板完整图片"
                  className="max-h-[380px] w-full object-contain transition-transform duration-300 group-hover/img:scale-[1.02]"
                />
                <div className="absolute bottom-3 right-3 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md text-white text-xs opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center gap-1.5 shadow-lg">
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>点击全屏放大</span>
                </div>
              </div>
            ) : (
              <div className="h-48 bg-surface-container-highest rounded-2xl border border-outline-variant/30 flex items-center justify-center">
                <ImageIcon className="w-10 h-10 text-on-surface-variant/30" />
              </div>
            )}

            {/* OCR 识别结果提取 */}
            {clip.ocr_text && (
              <div className="bg-primary/5 rounded-2xl p-5 border border-primary/15 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-primary font-bold text-xs">
                    <Bot className="w-4 h-4" />
                    <span>AI 智能文字识别 (OCR)</span>
                  </div>
                  <button
                    onClick={handleCopyOcr}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer",
                      copiedOcr
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-primary/10 text-primary hover:bg-primary/20"
                    )}
                  >
                    {copiedOcr ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedOcr ? '已复制' : '复制识别文本'}</span>
                  </button>
                </div>
                <p className="text-sm font-mono text-on-surface leading-relaxed break-words whitespace-pre-wrap select-text bg-surface-container-low/60 p-3.5 rounded-xl border border-outline-variant/20">
                  {clip.ocr_text}
                </p>
              </div>
            )}
          </div>
        )}

        {/* 关联知识模块卡片 */}
        <div className="bg-surface-container-low/80 rounded-2xl p-4 border border-outline-variant/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-xs font-bold text-on-surface">
            <Link2 className="w-4 h-4 text-primary" />
            <span>关联文档、任务与灵感</span>
          </div>
          <Button onClick={() => setShowLinks(true)} variant="outline" size="sm" className="text-xs">
            管理关联
          </Button>
        </div>
      </div>

      {showLinks && <LinkPanel type="clipboard" id={clip.id} onClose={() => setShowLinks(false)} />}
    </div>
  )
}
