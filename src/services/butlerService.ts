import * as aiService from './aiService'
import * as clipboardService from './clipboardService'
import type { ButlerHistoryMessage, ButlerRequestContext } from '@/types/butler'
import type { ButlerSkill } from '@/types/skill'

const DEFAULT_SYSTEM_PROMPT = `你是 FlowBox 的 AI Butler。

你的回复要求：
1. 优先直接完成用户请求，不要寒暄。
2. 语言默认使用中文，除非用户明确要求别的语言。
3. 如果是改写、翻译、摘要、修复代码，直接给结果。
4. 如果信息不足，明确说明缺什么，不要编造。
5. 输出保持简洁、可执行。`

function buildSystemPrompt(promptTemplate: string, skillSystemPrompt?: string): string {
  let base = DEFAULT_SYSTEM_PROMPT

  // 技能专属 system prompt 优先
  if (skillSystemPrompt?.trim()) {
    base = `${base}\n\n${skillSystemPrompt.trim()}`
  }

  if (promptTemplate && promptTemplate !== '默认助手') {
    base = `${base}\n\n当前 Prompt 模板：${promptTemplate}`
  }

  return base
}

/** 根据 skill 组合用户输入 */
export function composeButlerPrompt(input: string, skill: ButlerSkill | null): string {
  const trimmed = input.trim()
  if (!skill) return trimmed

  const prefix = skill.prompt_prefix
  if (!prefix) return trimmed
  if (!trimmed) return prefix.trim()
  if (trimmed.startsWith(prefix.trim())) return trimmed
  return `${prefix}${trimmed}`
}

/** 根据 skill ID 判断是否为截图分析技能 */
function isImageAnalysisSkill(skillId: string | null): boolean {
  return skillId === 'builtin-analyze-img'
}

function toChatHistory(history: ButlerHistoryMessage[]): aiService.ChatInputMessage[] {
  return history.map((message) => ({
    role: message.role,
    content: message.content,
  }))
}

export async function sendButlerMessage(request: ButlerRequestContext): Promise<string> {
  if (isImageAnalysisSkill(request.skillId)) {
    return analyzeLatestClipboardImage(request)
  }

  const composedInput = request.promptPrefix
    ? (request.input.trim().startsWith(request.promptPrefix.trim())
      ? request.input.trim()
      : `${request.promptPrefix}${request.input.trim()}`)
    : request.input.trim()

  return aiService.chatWithAssistant({
    input: composedInput,
    systemPrompt: buildSystemPrompt(request.promptTemplate, request.skillSystemPrompt),
    history: toChatHistory(request.history),
    temperature: 0.4,
  })
}

/**
 * 流式发送 Butler 消息 — 逐 token 回调
 * 图片分析暂不支持流式，会回退到普通模式
 */
export async function sendButlerMessageStream(
  request: ButlerRequestContext,
  onToken: (token: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  if (isImageAnalysisSkill(request.skillId)) {
    const result = await analyzeLatestClipboardImage(request)
    onToken(result)
    return result
  }

  const composedInput = request.promptPrefix
    ? (request.input.trim().startsWith(request.promptPrefix.trim())
      ? request.input.trim()
      : `${request.promptPrefix}${request.input.trim()}`)
    : request.input.trim()

  return aiService.chatWithAssistantStream({
    input: composedInput,
    systemPrompt: buildSystemPrompt(request.promptTemplate, request.skillSystemPrompt),
    history: toChatHistory(request.history),
    temperature: 0.4,
    onToken,
    signal,
  })
}

export async function analyzeLatestClipboardImage(request: ButlerRequestContext): Promise<string> {
  const [latestImage] = await clipboardService.clipList({ content_type: 'image', limit: 1 })

  if (!latestImage?.image_path) {
    throw new Error('没有最近截图可分析。请先复制一张图片到剪贴板。')
  }

  const composedInput = request.promptPrefix
    ? `${request.promptPrefix}${request.input.trim()}`
    : request.input.trim()

  return aiService.chatWithVision({
    prompt: composedInput || '请分析最近一张截图，说明关键内容、可能问题和下一步建议。',
    imagePath: latestImage.image_path,
    systemPrompt: buildSystemPrompt(request.promptTemplate, request.skillSystemPrompt),
    temperature: 0.3,
  })
}

export async function regenerateButlerMessage(request: ButlerRequestContext | null): Promise<string> {
  if (!request) {
    throw new Error('没有可重新生成的 Butler 请求。')
  }
  return sendButlerMessage(request)
}

export async function optimizeButlerReply(content: string, promptTemplate: string): Promise<string> {
  return sendButlerMessage({
    input: content,
    skillId: 'builtin-polish',
    promptPrefix: '帮我润色这段文字：\n\n',
    promptTemplate,
    skillSystemPrompt: '',
    history: [],
  })
}

export async function getButlerModelLabel(): Promise<string> {
  return aiService.getAiModelLabel()
}
