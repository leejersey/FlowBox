import { Bot, Sparkles, Globe, FileText, Code2, ImageIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { ButlerFooter } from './ButlerFooter'
import { ChatMessageItem } from './ChatMessageItem'
import { cn } from '@/lib/utils'
import { showToast } from '@/store/useToastStore'
import { useButlerStore } from '@/stores/butlerStore'
import {
  BUTLER_ACTION_PREFIXES,
  composeButlerPrompt,
  getButlerModelLabel,
  sendButlerMessageStream,
} from '@/services/butlerService'
import type { ButlerActionId, ButlerHistoryMessage, ButlerRequestContext, ChatMessage } from '@/types/butler'

interface ButlerWorkbenchProps {
  className?: string
}

const QUICK_ACTIONS: Array<{
  id: ButlerActionId
  icon: typeof Sparkles
  label: string
}> = [
  { id: 'polish', icon: Sparkles, label: '润色文本' },
  { id: 'translate', icon: Globe, label: '翻译' },
  { id: 'summarize', icon: FileText, label: '摘要' },
  { id: 'fix_code', icon: Code2, label: '修复代码' },
  { id: 'analyze_img', icon: ImageIcon, label: '分析截图' },
]

function buildHistory(messages: ChatMessage[]): ButlerHistoryMessage[] {
  return messages
    .filter((message): message is ChatMessage & { role: 'user' | 'assistant' } =>
      message.role === 'user' || message.role === 'assistant'
    )
    .slice(-8)
    .map((message) => ({
      role: message.role,
      content: message.content,
    }))
}

export function ButlerWorkbench({ className }: ButlerWorkbenchProps) {
  const {
    messages,
    addMessage,
    addMessageWithId,
    appendToMessage,
    finalizeMessage,
    clearMessages,
    currentModel,
    promptTemplate,
    isLoading,
    lastRequest,
    setLoading,
    setLastRequest,
    setModel,
    initFromDb,
  } = useButlerStore()
  const abortRef = useRef<AbortController | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [selectedActionId, setSelectedActionId] = useState<ButlerActionId | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    initFromDb()
  }, [initFromDb])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    void getButlerModelLabel()
      .then(setModel)
      .catch(() => {})
  }, [setModel])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const submitRequest = useCallback(async (
    request: ButlerRequestContext,
    options?: {
      userBubbleContent?: string | null
    }
  ) => {
    setLoading(true)
    setLastRequest(request)

    if (options?.userBubbleContent) {
      addMessage({ role: 'user', content: options.userBubbleContent })
    }

    const msgId = Math.random().toString(36).substring(2, 15)
    addMessageWithId(msgId, { role: 'assistant', content: '' })

    const controller = new AbortController()
    abortRef.current = controller

    try {
      await sendButlerMessageStream(
        request,
        (token) => appendToMessage(msgId, token),
        controller.signal,
      )
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      const message = err instanceof Error ? err.message : String(err)
      showToast(message, 'error')
    } finally {
      finalizeMessage(msgId)
      abortRef.current = null
      setLoading(false)
    }
  }, [addMessage, addMessageWithId, appendToMessage, finalizeMessage, setLastRequest, setLoading])

  const canSend = useMemo(() => Boolean(inputValue.trim()) && !isLoading, [inputValue, isLoading])

  const handleSend = useCallback(async () => {
    const rawInput = inputValue.trim()
    if (!rawInput || isLoading) return

    const request: ButlerRequestContext = {
      input: rawInput,
      actionId: selectedActionId,
      promptTemplate,
      history: buildHistory(messages),
    }

    const userBubbleContent = composeButlerPrompt(rawInput, selectedActionId)
    setInputValue('')
    setSelectedActionId(null)
    await submitRequest(request, { userBubbleContent })
  }, [inputValue, isLoading, messages, promptTemplate, selectedActionId, submitRequest])

  const handleQuickAction = useCallback((actionId: ButlerActionId) => {
    setSelectedActionId(actionId)
    setInputValue(BUTLER_ACTION_PREFIXES[actionId])
    inputRef.current?.focus()
  }, [])

  const handleCopy = useCallback(async (message: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(message.content)
      showToast('Butler 回复已复制到剪贴板', 'success')
    } catch (err) {
      showToast(`复制失败: ${String(err)}`, 'error')
    }
  }, [])

  const handleOptimize = useCallback(async (message: ChatMessage) => {
    if (isLoading) return

    const request: ButlerRequestContext = {
      input: message.content,
      actionId: 'polish',
      promptTemplate,
      history: [],
    }

    addMessage({ role: 'user', content: '请优化上一条回复' })
    await submitRequest(request)
  }, [addMessage, isLoading, promptTemplate, submitRequest])

  const handleRegenerate = useCallback(async () => {
    if (isLoading || !lastRequest) return
    await submitRequest(lastRequest)
  }, [isLoading, lastRequest, submitRequest])

  const handleInputKeyDown = useCallback((e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }, [handleSend])

  return (
    <div className={cn(
      'bg-surface/95 backdrop-blur-3xl w-full max-w-3xl max-h-full h-[80vh] flex flex-col rounded-3xl shadow-[0_32px_80px_-20px_rgba(0,0,0,0.5)] border border-white/20 ring-1 ring-black/5 overflow-hidden',
      className
    )}>
      <div className="flex flex-col border-b border-surface-container-highest shrink-0 pt-6 px-6 pb-4 bg-surface/50 backdrop-blur-md z-20">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Bot className="w-6 h-6 text-primary" />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="问我任何事情，或拖入文本/代码..."
            className="flex-1 bg-transparent border-none outline-none text-xl font-medium text-on-surface placeholder:text-on-surface-variant/40 placeholder:font-normal"
          />
          <button
            onClick={() => void handleSend()}
            disabled={!canSend}
            className={cn(
              'flex items-center justify-center gap-2 px-4 py-2 rounded-xl transition-all shadow-sm font-medium',
              canSend
                ? 'bg-primary text-white hover:bg-primary/90 hover:shadow-md cursor-pointer'
                : 'bg-surface-container-highest text-on-surface-variant/50 cursor-not-allowed'
            )}
          >
            <span>{isLoading ? '处理中' : '发送'}</span>
            <div className="flex items-center opacity-70">
              <kbd className="font-sans text-[10px] mr-0.5">⌘</kbd>
              <kbd className="font-sans text-[10px]">Enter</kbd>
            </div>
          </button>
        </div>

        <div className="flex flex-row gap-2 mt-5 overflow-x-auto pb-1 scrollbar-none mask-fade-edges">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.id}
              onClick={() => handleQuickAction(action.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-low border border-surface-container-highest text-[13px] font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container hover:border-surface-container transition-all whitespace-nowrap shrink-0 group"
            >
              <action.icon className="w-3.5 h-3.5 group-hover:text-primary transition-colors" />
              {action.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 relative">
        {messages.length === 0 && !isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center opacity-40 text-on-surface-variant mb-12">
            <Bot className="w-16 h-16 mb-4 opacity-50 stroke-[1.5]" />
            <p className="text-sm font-medium">随时待命</p>
            <p className="text-xs mt-1">输入指令或点击上面的快捷操作开始</p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {messages.map((msg) => (
              <ChatMessageItem
                key={msg.id}
                message={msg}
                onCopy={handleCopy}
                onOptimize={handleOptimize}
                onRegenerate={handleRegenerate}
              />
            ))}
            {isLoading && messages.length > 0 && messages[messages.length - 1].content === '' && (
              <div className="ml-11 text-xs text-on-surface-variant animate-pulse">
                ▍ 正在生成...
              </div>
            )}
            <div ref={messagesEndRef} className="h-1 w-full" />
          </div>
        )}
      </div>

      <ButlerFooter onClear={clearMessages} currentModel={currentModel} />
    </div>
  )
}
