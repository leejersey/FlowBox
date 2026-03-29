import { useState, useEffect, useCallback, useRef } from 'react'
import { Mic, Play, Pause, Trash2, Download, RefreshCw, Square } from 'lucide-react'
import { isTauri } from '@tauri-apps/api/core'
import { cn } from '@/lib/utils'
import * as voiceService from '@/services/voiceService'
import type { VoiceRecord } from '@/types/voice'
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder'
import { useVoiceTranscribe } from '@/hooks/useVoiceTranscribe'
import * as settingsService from '@/services/settingsService'

const isTauriApp = isTauri()

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function timeLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const today = new Date().toISOString().slice(0, 10)
  const dateOnly = dateStr.slice(0, 10)
  const time = d.toTimeString().slice(0, 5)
  if (dateOnly === today) return `今天 ${time}`
  return `${dateOnly} ${time}`
}

function RecordCard({ record, onDelete, onExpand, expanded, onTranscribe, transcribing }: {
  record: VoiceRecord
  onDelete: (id: number) => void
  onExpand: (id: number) => void
  expanded: boolean
  onTranscribe?: (id: number) => void
  transcribing?: boolean
}) {
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const todos: string[] = record.ai_todos ? JSON.parse(record.ai_todos) : []

  useEffect(() => {
    // Only set up the audio element if there's a valid data string in `audio_path`
    // (Assuming audio_path holds the data URL, e.g., "data:audio/webm;base64,...")
    if (record.audio_path && record.audio_path.startsWith('data:audio')) {
      audioRef.current = new Audio(record.audio_path)
      audioRef.current.onended = () => setIsPlaying(false)
    }
    
    // Cleanup
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
        audioRef.current = null
      }
    }
  }, [record.audio_path])

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent card expansion when clicking play 
    if (!audioRef.current) return
    
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play()
      setIsPlaying(true)
    }
  }

  return (
    <div className={cn(
      "bg-surface-container rounded-[24px] overflow-hidden transition-all duration-300 shadow-sm border border-transparent",
      expanded ? "border-primary/20 shadow-md bg-surface" : "hover:bg-surface-container-highest cursor-pointer"
    )}>
      <div className="p-5 flex items-center justify-between" onClick={() => onExpand(record.id)}>
        <div className="flex items-center gap-4">
          <button 
            onClick={togglePlay}
            disabled={!record.audio_path || !record.audio_path.startsWith('data:audio')}
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed",
              isPlaying ? "bg-red-500/10 text-red-500 hover:bg-red-500/20" : "bg-surface-container-highest text-primary hover:bg-primary hover:text-white"
            )}
            title={isPlaying ? "暂停" : "播放录音"}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>
          <div className="flex flex-col gap-1">
            <span className="text-[15px] font-medium text-on-surface">
              {record.ai_summary?.slice(0, 30) || `录音 #${record.id}`}
            </span>
            <div className="flex items-center gap-2 text-xs text-on-surface-variant">
              <span>{timeLabel(record.created_at)}</span>
              <span>·</span>
              <span>{formatDuration(record.duration_seconds)}</span>
            </div>
          </div>
        </div>

        <div className={cn(
          "px-3 py-1.5 text-xs font-bold rounded-full",
          record.status === 'done' ? "bg-green-500/10 text-green-600" :
          record.status === 'processing' ? "bg-amber-500/10 text-amber-600 animate-pulse" :
          record.status === 'error' ? "bg-red-500/10 text-red-600" :
          "bg-red-500/10 text-red-600"
        )}>
          {record.status === 'done' ? '✅ 已转写' : record.status === 'processing' ? '⏳ 转写中' : record.status === 'error' ? '❌ 失败' : '🎙️ 录音中'}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-surface-container-highest bg-surface-container-low/50 relative">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/20" />
          <div className="p-6 md:p-8 flex flex-col gap-8">
            <div className="space-y-6">
              {record.ai_summary ? (
                <div>
                  <h4 className="text-sm font-bold text-on-surface mb-2 flex items-center gap-2">📝 摘要小结</h4>
                  <p className="text-[15px] leading-relaxed text-on-surface-variant bg-surface rounded-xl p-4 shadow-sm border border-white/40">
                    {record.ai_summary}
                  </p>
                </div>
              ) : null}

              {todos.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-on-surface mb-3 flex items-center gap-2">✅ 提取的待办事项</h4>
                  <div className="flex flex-col gap-2">
                    {todos.map((todo, i) => (
                      <div key={i} className="flex items-start gap-3 bg-surface p-3 rounded-xl border border-white/40 shadow-sm">
                        <div className="w-5 h-5 rounded border-2 border-primary/30 shrink-0 mt-0.5" />
                        <span className="text-[15px] text-on-surface">{todo}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {record.transcript && (
                <>
                  <div className="h-px w-full bg-surface-container-highest" />

                  <div>
                    <h4 className="text-sm font-bold text-on-surface mb-3 text-opacity-70">原声转写</h4>
                    <p className="text-[15px] leading-relaxed text-on-surface-variant/80 whitespace-pre-wrap">{record.transcript}</p>
                  </div>
                </>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button onClick={(e) => { e.stopPropagation(); onDelete(record.id) }} className="p-2.5 hover:bg-surface-container rounded-xl text-red-500 hover:text-red-600 hover:bg-red-500/10 transition-colors flex items-center gap-2 text-sm font-medium">
                  <Trash2 className="w-4 h-4" /> 删除录音
                </button>
                <button className="p-2.5 hover:bg-surface-container rounded-xl text-on-surface-variant transition-colors flex items-center gap-2 text-sm font-medium">
                  <Download className="w-4 h-4" /> 导出文本
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onTranscribe?.(record.id) }}
                  disabled={transcribing}
                  className={cn(
                    "p-2.5 rounded-xl transition-colors flex items-center gap-2 text-sm font-medium",
                    transcribing
                      ? "bg-primary/10 text-primary cursor-wait"
                      : "hover:bg-surface-container text-on-surface-variant"
                  )}
                >
                  <RefreshCw className={cn("w-4 h-4", transcribing && "animate-spin")} />
                  {transcribing ? '转写中...' : '重新转写'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function VoicePage() {
  const [records, setRecords] = useState<VoiceRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const refresh = useCallback(async () => {
    if (!isTauriApp) return
    setLoading(true)
    try {
      const list = await voiceService.voiceList()
      setRecords(list)
      if (list.length > 0 && !expandedId) setExpandedId(list[0].id)
    } finally {
      setLoading(false)
    }
  }, [expandedId])

  useEffect(() => { refresh() }, [refresh])

  const handleDelete = async (id: number) => {
    await voiceService.voiceDelete(id)
    if (expandedId === id) setExpandedId(null)
    await refresh()
  }

  // Hook handles our media stream recording
  const { isRecording, duration, startRecording, stopRecording } = useVoiceRecorder(refresh)

  // AI 转写
  const { transcribingId, transcribeRecord } = useVoiceTranscribe(refresh)

  // 录音完成后自动转写（如果设置启用了）
  const autoTranscribeRef = useRef<(() => void) | null>(null)
  useEffect(() => {
    autoTranscribeRef.current = async () => {
      try {
        const autoEnabled = await settingsService.settingsGet('ai.auto_voice_summary')
        if (autoEnabled === 'true' && records.length > 0) {
          const latest = records[0]
          if (latest.status === 'recording' && !latest.transcript) {
            transcribeRecord(latest.id)
          }
        }
      } catch { /* ignore */ }
    }
  }, [records, transcribeRecord])

  return (
    <div className="flex flex-col h-full animate-fade-in w-full max-w-4xl mx-auto pb-10 overflow-y-auto overflow-x-hidden">
      {/* Recording Panel */}
      <div className="bg-surface-container-low rounded-[32px] p-8 md:p-12 mb-10 flex flex-col items-center justify-center relative shadow-sm border border-white/40 overflow-hidden">
        
        <div className="relative flex items-center justify-center mb-6 pt-2 h-32 w-32">
          {/* Animated background rings when recording */}
          {isRecording && (
            <>
              <div className="absolute w-48 h-48 bg-red-500/20 rounded-full animate-ping z-0 pointer-events-none" style={{ animationDuration: '2s' }} />
              <div className="absolute w-32 h-32 bg-red-500/40 rounded-full animate-pulse z-0 pointer-events-none" />
            </>
          )}

          <div className="relative z-10">
            {isRecording ? (
               <button 
                 onClick={stopRecording}
                 className="relative w-24 h-24 rounded-full flex items-center justify-center transition-all bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30"
               >
                 <Square className="w-8 h-8 fill-current" />
               </button>
            ) : (
              <button 
                onClick={startRecording}
                className="relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-105 shadow-lg primary-gradient-button"
              >
                <Mic className="w-10 h-10" />
              </button>
            )}
          </div>
        </div>
        
        <div className="text-center z-10 min-h-[60px]">
          {isRecording ? (
            <>
              <h2 className="text-2xl font-display font-bold text-red-500 mb-1 animate-pulse">
                {formatDuration(duration)}
              </h2>
              <p className="text-sm font-medium text-on-surface-variant">点击方块停止录音</p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-display font-bold text-on-surface mb-2">点击开始录音</h2>
              <p className="text-sm text-on-surface-variant">💡 录音结束后，AI 将自动转写并提取待办事项和核心观点</p>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mb-6 px-1">
        <h3 className="text-xl font-display font-bold text-on-surface">
          录音历史
          {records.length > 0 && <span className="ml-2 text-sm font-normal text-on-surface-variant">{records.length} 条</span>}
        </h3>
      </div>

      {loading && <div className="text-center text-on-surface-variant py-12">加载中...</div>}

      <div className="flex flex-col gap-4">
        {records.map(record => (
          <RecordCard
            key={record.id}
            record={record}
            onDelete={handleDelete}
            onExpand={id => setExpandedId(expandedId === id ? null : id)}
            expanded={expandedId === record.id}
            onTranscribe={transcribeRecord}
            transcribing={transcribingId === record.id}
          />
        ))}
      </div>

      {!loading && records.length === 0 && (
        <div className="text-center text-on-surface-variant py-16">
          <p className="text-lg mb-2">🎙️ 暂无录音</p>
          <p className="text-sm">点击上方麦克风按钮开始录音</p>
        </div>
      )}
    </div>
  )
}
