/**
 * AI 服务层 — 语音转写 + 摘要提取
 *
 * 转写方案：浏览器 Web Speech API（免费，无需 API Key）
 * 摘要方案：DeepSeek API（OpenAI 兼容接口）
 */

import * as settingsService from './settingsService'
import { convertFileSrc, isTauri } from '@tauri-apps/api/core'

// ─── 配置 ──────────────────────────────────────────

interface AiConfig {
  provider: string
  apiKey: string
  baseUrl: string
  model: string
}

async function getAiConfig(): Promise<AiConfig> {
  const provider = await settingsService.settingsGet('ai.provider') ?? 'deepseek'
  const apiKey = await settingsService.settingsGet('ai.openai_api_key') ?? ''

  if (provider === 'openai') {
    return {
      provider,
      apiKey,
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
    }
  }

  if (provider === 'ollama') {
    return {
      provider,
      apiKey: '',
      baseUrl: 'http://127.0.0.1:11434/v1',
      model: 'llama3.2',
    }
  }

  // DeepSeek（默认）
  return {
    provider,
    apiKey,
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
  }
}

function ensureApiAccess(config: AiConfig) {
  if (!config.apiKey && config.provider !== 'ollama') {
    throw new Error('请先在设置中配置 AI API Key。')
  }
}

function getAuthHeaders(config: AiConfig): Record<string, string> {
  if (config.provider === 'ollama') return {}
  return { Authorization: `Bearer ${config.apiKey}` }
}

export interface ChatInputMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function getAiModelLabel(): Promise<string> {
  const config = await getAiConfig()
  const providerLabel =
    config.provider === 'openai'
      ? 'OpenAI'
      : config.provider === 'ollama'
        ? 'Ollama'
        : 'DeepSeek'

  return `${providerLabel} - ${config.model}`
}

async function callChatCompletion(params: {
  messages: Array<
    | { role: 'system' | 'user' | 'assistant'; content: string }
    | { role: 'user'; content: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> }
  >
  temperature?: number
}) {
  const config = await getAiConfig()
  ensureApiAccess(config)

  const resp = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(config),
    },
    body: JSON.stringify({
      model: config.model,
      messages: params.messages,
      temperature: params.temperature ?? 0.5,
    }),
  })

  if (!resp.ok) {
    const errBody = await resp.text()
    throw new Error(`AI API 错误 (${resp.status}): ${errBody}`)
  }

  const data = await resp.json()
  const content = data.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('AI 未返回有效内容。')
  }
  return content.trim()
}

export async function chatWithAssistant(params: {
  input: string
  systemPrompt?: string
  history?: ChatInputMessage[]
  temperature?: number
}): Promise<string> {
  const messages: ChatInputMessage[] = []

  if (params.systemPrompt?.trim()) {
    messages.push({ role: 'system', content: params.systemPrompt.trim() })
  }

  if (params.history?.length) {
    messages.push(...params.history)
  }

  messages.push({ role: 'user', content: params.input.trim() })

  return callChatCompletion({
    messages,
    temperature: params.temperature,
  })
}

/**
 * 流式对话 — 逐 token 输出
 * DeepSeek / OpenAI 均支持 SSE stream
 */
export async function chatWithAssistantStream(params: {
  input: string
  systemPrompt?: string
  history?: ChatInputMessage[]
  temperature?: number
  onToken: (token: string) => void
  signal?: AbortSignal
}): Promise<string> {
  const config = await getAiConfig()
  ensureApiAccess(config)

  const messages: ChatInputMessage[] = []
  if (params.systemPrompt?.trim()) {
    messages.push({ role: 'system', content: params.systemPrompt.trim() })
  }
  if (params.history?.length) {
    messages.push(...params.history)
  }
  messages.push({ role: 'user', content: params.input.trim() })

  const resp = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(config),
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: params.temperature ?? 0.5,
      stream: true,
    }),
    signal: params.signal,
  })

  if (!resp.ok) {
    const errBody = await resp.text()
    throw new Error(`AI API 错误 (${resp.status}): ${errBody}`)
  }

  const reader = resp.body?.getReader()
  if (!reader) throw new Error('浏览器不支持流式读取。')

  const decoder = new TextDecoder()
  let fullContent = ''
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    // 保留最后一行（可能不完整）
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (payload === '[DONE]') continue

      try {
        const json = JSON.parse(payload)
        const delta = json.choices?.[0]?.delta?.content
        if (typeof delta === 'string' && delta) {
          fullContent += delta
          params.onToken(delta)
        }
      } catch {
        // 跳过无法解析的行
      }
    }
  }

  if (!fullContent.trim()) {
    throw new Error('AI 未返回有效内容。')
  }
  return fullContent.trim()
}

async function imagePathToDataUrl(imagePath: string): Promise<string> {
  if (imagePath.startsWith('data:')) return imagePath

  const source = imagePath.startsWith('file://')
    ? imagePath
    : isTauri()
      ? convertFileSrc(imagePath)
      : imagePath

  const resp = await fetch(source)
  if (!resp.ok) {
    throw new Error('读取截图文件失败。')
  }

  const blob = await resp.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('截图编码失败。'))
      }
    }
    reader.onerror = () => reject(new Error('截图编码失败。'))
    reader.readAsDataURL(blob)
  })
}

export async function chatWithVision(params: {
  prompt: string
  imagePath: string
  systemPrompt?: string
  temperature?: number
}): Promise<string> {
  const config = await getAiConfig()
  ensureApiAccess(config)

  if (config.provider !== 'openai') {
    throw new Error('当前模型不支持图片分析。请在设置中切换到 OpenAI。')
  }

  const imageDataUrl = await imagePathToDataUrl(params.imagePath)
  const messages: Array<
    | { role: 'system' | 'user' | 'assistant'; content: string }
    | { role: 'user'; content: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> }
  > = []

  if (params.systemPrompt?.trim()) {
    messages.push({ role: 'system', content: params.systemPrompt.trim() })
  }

  messages.push({
    role: 'user',
    content: [
      { type: 'text', text: params.prompt.trim() },
      { type: 'image_url', image_url: { url: imageDataUrl } },
    ],
  })

  return callChatCompletion({
    messages,
    temperature: params.temperature,
  })
}

// ─── 语音转写：浏览器 Web Speech API ─────────────────

/**
 * 使用浏览器内置的 SpeechRecognition 进行实时转写。
 * 注意：此函数需要在录音时调用（实时流式识别），而非录完后离线识别。
 * 
 * 对于已录制的音频，我们改用「播放+识别」的方式来模拟转写。
 */

/** 将 base64 Data URL 还原为 Blob */
export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',')
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'audio/webm'
  const bstr = atob(parts[1])
  const u8arr = new Uint8Array(bstr.length)
  for (let i = 0; i < bstr.length; i++) {
    u8arr[i] = bstr.charCodeAt(i)
  }
  return new Blob([u8arr], { type: mime })
}

/**
 * 使用 Web Speech API 转写已录制的音频
 * 原理：将音频通过 AudioContext 播放到虚拟输出,同时用 SpeechRecognition 监听
 * 
 * 兜底：如果 SpeechRecognition 不可用（如 Tauri WebView），
 * 则回退到 DeepSeek/OpenAI 的 Whisper API（如果 apiKey 存在）。
 */
export async function transcribeAudio(audioDataUrl: string): Promise<string> {
  // 首先尝试 Web Speech API
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

  if (SpeechRecognition) {
    return transcribeWithWebSpeech(audioDataUrl, SpeechRecognition)
  }

  // 兜底：检查是否有 API Key 可以用 Whisper
  const config = await getAiConfig()
  if (config.apiKey && config.baseUrl.includes('openai')) {
    return transcribeWithWhisper(audioDataUrl, config.apiKey)
  }

  throw new Error('当前环境不支持语音识别。请使用 Chrome 浏览器，或在设置中填入 OpenAI API Key。')
}

/** Web Speech API 转写 */
function transcribeWithWebSpeech(audioDataUrl: string, SpeechRecognitionClass: any): Promise<string> {
  return new Promise((resolve, reject) => {
    const recognition = new SpeechRecognitionClass()
    recognition.lang = 'zh-CN'
    recognition.continuous = true
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    const blob = dataUrlToBlob(audioDataUrl)
    const audioUrl = URL.createObjectURL(blob)
    const audio = new Audio(audioUrl)

    let fullTranscript = ''
    let hasResult = false

    recognition.onresult = (event: any) => {
      hasResult = true
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          fullTranscript += event.results[i][0].transcript
        }
      }
    }

    recognition.onend = () => {
      audio.pause()
      URL.revokeObjectURL(audioUrl)
      if (hasResult) {
        resolve(fullTranscript || '（未识别到语音内容）')
      } else {
        resolve('（未识别到语音内容，请检查录音是否包含语音）')
      }
    }

    recognition.onerror = (event: any) => {
      audio.pause()
      URL.revokeObjectURL(audioUrl)
      if (event.error === 'no-speech') {
        resolve('（未检测到语音）')
      } else {
        reject(new Error(`语音识别错误: ${event.error}`))
      }
    }

    // 播放音频的同时启动识别
    audio.play().then(() => {
      recognition.start()
    }).catch(err => {
      reject(new Error(`播放音频失败: ${err.message}`))
    })

    // 音频播放完毕后停止识别
    audio.onended = () => {
      // 给一小段缓冲时间让识别完成
      setTimeout(() => {
        try { recognition.stop() } catch { /* already stopped */ }
      }, 1500)
    }
  })
}

/** Whisper API 转写（兜底方案） */
async function transcribeWithWhisper(audioDataUrl: string, apiKey: string): Promise<string> {
  const blob = dataUrlToBlob(audioDataUrl)
  const formData = new FormData()
  formData.append('file', blob, 'audio.webm')
  formData.append('model', 'whisper-1')
  formData.append('language', 'zh')

  const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  })

  if (!resp.ok) {
    const errBody = await resp.text()
    throw new Error(`Whisper API 错误 (${resp.status}): ${errBody}`)
  }

  const data = await resp.json()
  return data.text || '（未识别到内容）'
}

// ─── 摘要提取：DeepSeek / OpenAI Chat Completions ────

export interface SummaryResult {
  summary: string
  todos: string[]
}

const SUMMARY_PROMPT = `你是一个智能助手。请根据以下语音转写文本，完成两件事：

1. 用 1-3 句话总结核心内容，生成一段简洁的摘要。
2. 从文本中提取所有可执行的待办事项（如果有的话），输出为一个列表。

请严格按如下 JSON 格式返回，不要添加其他内容：
{
  "summary": "摘要内容",
  "todos": ["待办1", "待办2"]
}

如果没有可提取的待办事项，todos 返回空数组 []。

---

转写文本：
`

export async function summarizeTranscript(transcript: string): Promise<SummaryResult> {
  const config = await getAiConfig()

  if (!config.apiKey && config.provider !== 'ollama') {
    // 没有 API Key 时返回默认值
    return {
      summary: transcript.slice(0, 100) + (transcript.length > 100 ? '...' : ''),
      todos: [],
    }
  }

  const resp = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(config),
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'user', content: SUMMARY_PROMPT + transcript },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  })

  if (!resp.ok) {
    const errBody = await resp.text()
    throw new Error(`AI API 错误 (${resp.status}): ${errBody}`)
  }

  const data = await resp.json()
  const content = data.choices?.[0]?.message?.content ?? '{}'

  try {
    const parsed = JSON.parse(content)
    return {
      summary: parsed.summary || transcript.slice(0, 100),
      todos: Array.isArray(parsed.todos) ? parsed.todos : [],
    }
  } catch {
    // JSON 解析失败，返回原始内容作为摘要
    return {
      summary: content.slice(0, 200),
      todos: [],
    }
  }
}

// ─── 剪贴板 AI 分类 ──────────────────────────────────

const CLASSIFY_PROMPT = `你是一个文本分类器。请判断以下内容属于哪个类别，从以下选项中选一个最合适的：

- 代码：编程代码片段、脚本、配置文件
- 文档：文章、文档、段落、说明
- 链接：URL、网址
- 命令：终端命令、Shell 脚本
- 笔记：个人笔记、灵感、备忘
- 数据：JSON、CSV、表格数据、日志
- 其他：无法归类的内容

只返回类别名称，不要返回其他任何内容。

---

内容：
`

/**
 * 用 AI 对剪贴板内容进行智能分类
 * 分类结果：代码 | 文档 | 链接 | 命令 | 笔记 | 数据 | 其他
 */
export async function classifyClipboard(text: string): Promise<string | null> {
  const config = await getAiConfig()
  if (!config.apiKey && config.provider !== 'ollama') return null

  // 内容太短不值得调用 AI
  if (text.trim().length < 10) return null

  // 先做规则预判，节省 API 调用
  const trimmed = text.trim()
  if (/^https?:\/\//.test(trimmed)) return '链接'
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return '数据'
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) return '数据'

  try {
    // 只取前 500 字符避免 token 浪费
    const snippet = text.slice(0, 500)

    const resp = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(config),
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'user', content: CLASSIFY_PROMPT + snippet },
        ],
        temperature: 0.1,
        max_tokens: 10,
      }),
    })

    if (!resp.ok) return null

    const data = await resp.json()
    const raw = (data.choices?.[0]?.message?.content ?? '').trim()

    // 校验返回值是否在合法范围内
    const validCategories = ['代码', '文档', '链接', '命令', '笔记', '数据', '其他']
    const matched = validCategories.find(cat => raw.includes(cat))
    return matched ?? null
  } catch {
    return null
  }
}
