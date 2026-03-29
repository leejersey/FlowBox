/**
 * useVoiceTranscribe — 语音转写+摘要完整流程 Hook
 *
 * 调用 aiService 完成：音频转写 → 摘要提取 → 写入 DB
 */

import { useState, useCallback } from 'react'
import * as aiService from '@/services/aiService'
import * as voiceService from '@/services/voiceService'
import { showToast } from '@/store/useToastStore'

export function useVoiceTranscribe(onComplete?: () => void) {
  const [transcribingId, setTranscribingId] = useState<number | null>(null)

  const transcribeRecord = useCallback(async (recordId: number) => {
    setTranscribingId(recordId)

    try {
      // 1. 读取录音记录
      const records = await voiceService.voiceList()
      const record = records.find(r => r.id === recordId)
      if (!record) throw new Error('录音记录不存在')
      if (!record.audio_path) throw new Error('音频数据为空')

      // 2. 更新状态为 processing
      await voiceService.voiceUpdate(recordId, { status: 'processing' })
      onComplete?.()

      // 3. 转写音频
      showToast('正在转写语音...', 'info')
      const transcript = await aiService.transcribeAudio(record.audio_path)

      // 4. 更新转写文本
      await voiceService.voiceUpdate(recordId, { transcript })
      onComplete?.()

      // 5. AI 摘要提取
      showToast('正在生成摘要...', 'info')
      const { summary, todos } = await aiService.summarizeTranscript(transcript)

      // 6. 写入最终结果
      await voiceService.voiceUpdate(recordId, {
        ai_summary: summary,
        ai_todos: todos,
        status: 'done',
      })

      showToast('✅ 转写与摘要完成', 'success')
      onComplete?.()

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      showToast(`转写失败: ${msg}`, 'error')

      // 更新状态为 error
      try {
        await voiceService.voiceUpdate(recordId, { status: 'error' })
        onComplete?.()
      } catch { /* ignore */ }
    } finally {
      setTranscribingId(null)
    }
  }, [onComplete])

  return {
    transcribingId,
    isTranscribing: transcribingId !== null,
    transcribeRecord,
  }
}
