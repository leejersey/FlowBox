/**
 * 截图 OCR 服务层
 *
 * 截取屏幕/剪贴板图片 → AI Vision 识别文字 → 转为灵感或待办
 */

import { invoke, isTauri } from '@tauri-apps/api/core'
import * as aiService from './aiService'
import * as ideaService from './ideaService'
import * as todoService from './todoService'
import { normalizeOcrResult, ocrRoute } from '@/lib/ocrRouting'

// ─── 类型定义 ──────────────────────────────────────

export interface OcrResult {
  /** AI 识别的原始文本 */
  rawText: string
  /** AI 建议的标题（用于创建待办） */
  suggestedTitle: string
  /** AI 建议的标签 */
  suggestedTags: string[]
  /** AI 推荐类型：idea 或 todo */
  suggestedType: 'idea' | 'todo'
  /** 截图路径 */
  imagePath: string
}

// ─── 截图捕获 ──────────────────────────────────────

/**
 * 从系统剪贴板捕获截图
 * 调用流程：用户使用系统截图 → 截图自动进入剪贴板 → 此函数从剪贴板取出并保存
 */
export async function captureFromClipboard(): Promise<string> {
  if (!isTauri()) {
    throw new Error('截图功能仅在桌面端可用。')
  }

  return invoke<string>('screenshot_from_clipboard')
}

// ─── AI OCR 识别 ──────────────────────────────────

const OCR_SYSTEM_PROMPT = `你是 FlowBox 效率工具的 OCR 助手。用户会给你一张屏幕截图或其识别文字，请完成以下任务：

1. 准确识别图中所有文字内容
2. 判断内容更适合作为"灵感笔记"还是"待办事项"
3. 提取一个简洁的标题（不超过 20 字）
4. 提取 1-3 个相关标签

请严格按如下 JSON 格式返回（不要包裹在 markdown 代码块中）：
{
  "rawText": "识别到的所有文字",
  "suggestedTitle": "简洁标题",
  "suggestedTags": ["标签1", "标签2"],
  "suggestedType": "idea 或 todo"
}`

const OCR_USER_PROMPT = '请识别这张截图中的文字内容，并按要求返回 JSON 结果。'

/**
 * 对截图进行 AI OCR 识别
 */
export async function recognizeScreenshot(imagePath: string): Promise<OcrResult> {
  const provider = await aiService.getAiProvider()
  let result: string
  let fallbackRawText: string | undefined

  if (ocrRoute(provider) === 'vision') {
    result = await aiService.chatWithVision({
      prompt: OCR_USER_PROMPT,
      imagePath,
      systemPrompt: OCR_SYSTEM_PROMPT,
      temperature: 0.2,
    })
  } else {
    const recognizedText = await invoke<string>('ocr_recognize_text', { imagePath })
    if (!recognizedText.trim()) throw new Error('没有文本')
    fallbackRawText = recognizedText
    try {
      result = await aiService.chatWithAssistant({
        input: recognizedText,
        systemPrompt: OCR_SYSTEM_PROMPT,
        temperature: 0.2,
      })
    } catch (error) {
      throw new Error(`模型整理失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return { ...normalizeOcrResult(result, fallbackRawText), imagePath }
}

// ─── 保存为灵感/待办 ──────────────────────────────

/** 将 OCR 结果保存为灵感 */
export async function saveAsIdea(ocr: OcrResult): Promise<void> {
  await ideaService.ideaCreate(ocr.rawText, ocr.suggestedTags)
}

/** 将 OCR 结果创建为待办 */
export async function saveAsTodo(ocr: OcrResult): Promise<void> {
  await todoService.todoCreate({
    title: ocr.suggestedTitle,
    content: ocr.rawText,
    tags: ocr.suggestedTags,
    source: 'screenshot_ocr',
  })
}
