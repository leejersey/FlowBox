import { Bot, ChevronDown } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { ButlerFooter } from './ButlerFooter'
import { ChatMessageItem } from './ChatMessageItem'
import { cn } from '@/lib/utils'
import { getLucideIcon } from '@/lib/icons'
import { showToast } from '@/store/useToastStore'
import { useButlerStore } from '@/stores/butlerStore'
import {
  composeButlerPrompt,
  getButlerModelLabel,
  sendButlerMessageStream,
} from '@/services/butlerService'
import * as skillService from '@/services/skillService'
import type { ButlerHistoryMessage, ButlerRequestContext, ChatMessage } from '@/types/butler'
import type { ButlerSkill } from '@/types/skill'

interface ButlerWorkbenchProps {
  className?: string
}

/** Butler 工作台展示的快捷技能最大数量 */
const MAX_QUICK_SKILLS = 5

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
    activeSkillId,
    isLoading,
    lastRequest,
    setLoading,
    setLastRequest,
    setModel,
    setActiveSkillId,
    initFromDb,
  } = useButlerStore()
  const abortRef = useRef<AbortController | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [selectedSkill, setSelectedSkill] = useState<ButlerSkill | null>(null)
  const [skills, setSkills] = useState<ButlerSkill[]>([])
  const [showAllSkills, setShowAllSkills] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 加载技能列表
  useEffect(() => {
    skillService.loadSkills()
      .then(setSkills)
      .catch(() => {})
  }, [])

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

  const quickSkills = useMemo(() => skills.slice(0, MAX_QUICK_SKILLS), [skills])

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
      skillId: selectedSkill?.id ?? null,
      promptPrefix: selectedSkill?.prompt_prefix ?? '',
      promptTemplate,
      skillSystemPrompt: selectedSkill?.system_prompt ?? '',
      history: buildHistory(messages),
    }

    const userBubbleContent = composeButlerPrompt(rawInput, selectedSkill)
    setInputValue('')
    setSelectedSkill(null)
    await submitRequest(request, { userBubbleContent })
  }, [inputValue, isLoading, messages, promptTemplate, selectedSkill, submitRequest])

  const handleQuickSkill = useCallback((skill: ButlerSkill) => {
    setSelectedSkill(skill)
    setInputValue(skill.prompt_prefix)
    // 如果技能有自定义 system prompt，自动切换
    if (skill.system_prompt?.trim()) {
      setActiveSkillId(skill.id)
    }
    inputRef.current?.focus()
  }, [setActiveSkillId])

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

    const polishSkill = skills.find(s => s.id === 'builtin-polish')
    const request: ButlerRequestContext = {
      input: message.content,
      skillId: 'builtin-polish',
      promptPrefix: polishSkill?.prompt_prefix ?? '帮我润色这段文字：\n\n',
      promptTemplate,
      skillSystemPrompt: polishSkill?.system_prompt ?? '',
      history: [],
    }

    addMessage({ role: 'user', content: '请优化上一条回复' })
    await submitRequest(request)
  }, [addMessage, isLoading, promptTemplate, skills, submitRequest])

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

        {/* 快捷技能栏 — 动态加载 */}
        <div className="relative mt-5">
          <div className="flex flex-row gap-2 overflow-x-auto pb-1 scrollbar-none mask-fade-edges">
            {quickSkills.map((skill) => {
              const Icon = getLucideIcon(skill.icon)
              return (
                <button
                  key={skill.id}
                  onClick={() => handleQuickSkill(skill)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[13px] font-medium transition-all whitespace-nowrap shrink-0 group',
                    selectedSkill?.id === skill.id
                      ? 'bg-primary/15 border-primary/30 text-primary'
                      : 'bg-surface-container-low border-surface-container-highest text-on-surface-variant hover:text-on-surface hover:bg-surface-container hover:border-surface-container'
                  )}
                >
                  <Icon className="w-3.5 h-3.5 group-hover:text-primary transition-colors" style={selectedSkill?.id === skill.id ? { color: skill.color } : undefined} />
                  {skill.name}
                </button>
              )
            })}
            {skills.length > MAX_QUICK_SKILLS && (
              <button
                onClick={() => setShowAllSkills(!showAllSkills)}
                className={cn(
                  'flex items-center gap-1 px-3 py-1.5 rounded-lg border text-[13px] font-medium transition-all whitespace-nowrap shrink-0',
                  showAllSkills
                    ? 'bg-primary/10 border-primary/20 text-primary'
                    : 'bg-surface-container-low border-surface-container-highest text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                )}
              >
                +{skills.length - MAX_QUICK_SKILLS} 更多
                <ChevronDown className={cn('w-3 h-3 transition-transform', showAllSkills && 'rotate-180')} />
              </button>
            )}
          </div>

          {/* 展开的完整技能面板 */}
          {showAllSkills && skills.length > MAX_QUICK_SKILLS && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-surface-container-low/95 backdrop-blur-xl border border-surface-container-highest rounded-2xl shadow-xl p-4 z-30 animate-fade-in">
              <div className="grid grid-cols-4 gap-2">
                {skills.slice(MAX_QUICK_SKILLS).map((skill) => {
                  const Icon = getLucideIcon(skill.icon)
                  return (
                    <button
                      key={skill.id}
                      onClick={() => { handleQuickSkill(skill); setShowAllSkills(false) }}
                      className={cn(
                        'flex flex-col items-center gap-2 p-3 rounded-xl border transition-all group',
                        selectedSkill?.id === skill.id
                          ? 'bg-primary/15 border-primary/30'
                          : 'border-transparent hover:bg-surface-container hover:border-surface-container-highest'
                      )}
                    >
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110"
                        style={{ backgroundColor: `${skill.color}15` }}
                      >
                        <Icon className="w-4 h-4" style={{ color: skill.color }} />
                      </div>
                      <span className="text-[12px] font-medium text-on-surface-variant group-hover:text-on-surface text-center leading-tight">
                        {skill.name}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
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

      <ButlerFooter
        onClear={clearMessages}
        currentModel={currentModel}
        skills={skills}
        activeSkillId={activeSkillId}
        onSkillSelect={(id) => setActiveSkillId(id)}
      />
    </div>
  )
}
