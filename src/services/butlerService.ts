import * as aiService from './aiService'
import * as clipboardService from './clipboardService'
import type { ButlerActionId, ButlerHistoryMessage, ButlerRequestContext } from '@/types/butler'

export const BUTLER_ACTION_PREFIXES: Record<ButlerActionId, string> = {
  polish: '帮我润色这段文字：\n\n',
  translate: '帮我把这段话翻译成中文或英文：\n\n',
  summarize: '提取这段文本的摘要：\n\n',
  fix_code: '分析并修复这段代码的问题：\n\n',
  analyze_img: '请分析最近一张截图，说明关键内容、可能问题和下一步建议：\n\n',
}

const DEFAULT_SYSTEM_PROMPT = `你是 FlowBox 的 AI Butler。

你的回复要求：
1. 优先直接完成用户请求，不要寒暄。
2. 语言默认使用中文，除非用户明确要求别的语言。
3. 如果是改写、翻译、摘要、修复代码，直接给结果。
4. 如果信息不足，明确说明缺什么，不要编造。
5. 输出保持简洁、可执行。`

function buildSystemPrompt(promptTemplate: string): string {
  if (promptTemplate && promptTemplate !== '默认助手') {
    return `${DEFAULT_SYSTEM_PROMPT}\n\n当前 Prompt 模板：${promptTemplate}`
  }
  return DEFAULT_SYSTEM_PROMPT
}

export function composeButlerPrompt(input: string, actionId: ButlerActionId | null): string {
  const trimmed = input.trim()
  if (!actionId) return trimmed

  const prefix = BUTLER_ACTION_PREFIXES[actionId]
  if (!trimmed) return prefix.trim()
  if (trimmed.startsWith(prefix.trim())) return trimmed
  return `${prefix}${trimmed}`
}

function toChatHistory(history: ButlerHistoryMessage[]): aiService.ChatInputMessage[] {
  return history.map((message) => ({
    role: message.role,
    content: message.content,
  }))
}

export async function sendButlerMessage(request: ButlerRequestContext): Promise<string> {
  if (request.actionId === 'analyze_img') {
    return analyzeLatestClipboardImage(request)
  }

  return aiService.chatWithAssistant({
    input: composeButlerPrompt(request.input, request.actionId),
    systemPrompt: buildSystemPrompt(request.promptTemplate),
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
  if (request.actionId === 'analyze_img') {
    // Vision API 不支持流式，回退
    const result = await analyzeLatestClipboardImage(request)
    onToken(result)
    return result
  }

  return aiService.chatWithAssistantStream({
    input: composeButlerPrompt(request.input, request.actionId),
    systemPrompt: buildSystemPrompt(request.promptTemplate),
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

  return aiService.chatWithVision({
    prompt: composeButlerPrompt(request.input, 'analyze_img'),
    imagePath: latestImage.image_path,
    systemPrompt: buildSystemPrompt(request.promptTemplate),
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
    actionId: 'polish',
    promptTemplate,
    history: [],
  })
}

export async function getButlerModelLabel(): Promise<string> {
  return aiService.getAiModelLabel()
}
