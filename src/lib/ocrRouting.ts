export type OcrRoute = 'vision' | 'local-text'

export interface NormalizedOcrResult {
  rawText: string
  suggestedTitle: string
  suggestedTags: string[]
  suggestedType: 'idea' | 'todo'
}

export const ocrRoute = (provider: string): OcrRoute =>
  provider === 'openai' ? 'vision' : 'local-text'

export function normalizeOcrResult(result: string, fallbackRawText?: string): NormalizedOcrResult {
  const match = result.match(/```(?:json)?\s*([\s\S]*?)```/)
  const fallback = fallbackRawText?.trim() ? fallbackRawText : result
  try {
    const parsed = JSON.parse(match?.[1].trim() ?? result) as Partial<NormalizedOcrResult>
    const rawText = typeof parsed.rawText === 'string' && parsed.rawText.trim()
      ? parsed.rawText
      : fallback
    return {
      rawText,
      suggestedTitle: typeof parsed.suggestedTitle === 'string' && parsed.suggestedTitle.trim()
        ? parsed.suggestedTitle
        : rawText.slice(0, 20).replace(/\n/g, ' '),
      suggestedTags: Array.isArray(parsed.suggestedTags)
        ? parsed.suggestedTags.filter((tag): tag is string => typeof tag === 'string')
        : [],
      suggestedType: parsed.suggestedType === 'todo' ? 'todo' : 'idea',
    }
  } catch {
    return {
      rawText: fallback,
      suggestedTitle: fallback.slice(0, 20).replace(/\n/g, ' '),
      suggestedTags: [],
      suggestedType: 'idea',
    }
  }
}
