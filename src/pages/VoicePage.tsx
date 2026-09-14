import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Mic, Play, Pause, Trash2, Square, RefreshCw, Link2,
  CheckSquare, Clock, Copy, Plus, Sparkles, Volume2
} from 'lucide-react'
import { isTauri } from '@tauri-apps/api/core'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { cn } from '@/lib/utils'
import * as voiceService from '@/services/voiceService'
import { todoCreate } from '@/services/todoService'
import type { VoiceRecord } from '@/types/voice'
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder'
import { useVoiceTranscribe } from '@/hooks/useVoiceTranscribe'
import { localDateKey } from '@/lib/localDate'
import { ResizablePanel } from '@/components/ui/ResizablePanel'
import { ContextMenu, type ContextMenuItem } from '@/components/ui/ContextMenu'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { LinkPanel } from '@/components/links/LinkPanel'
import { ensureLinkedTarget, linkedTargetFor, linkedTargetId } from '@/lib/itemLink'
import { showToast } from '@/store/useToastStore'
import { playCopySuccessSound } from '@/lib/soundEffects'

const isTauriApp = isTauri()

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function timeLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const today = localDateKey()
  const dateOnly = localDateKey(d)
  const time = d.toTimeString().slice(0, 5)
  if (dateOnly === today) return `今天 ${time}`
  return `${dateOnly} ${time}`
}

// 紧凑型左侧录音卡片
function VoiceCard({
  record,
  isSelected,
  onClick,
  onDelete,
  onContextMenu,
}: {
  record: VoiceRecord
  isSelected?: boolean
  onClick: (record: VoiceRecord) => void
  onDelete: (id: number) => void
  onContextMenu?: (e: React.MouseEvent, record: VoiceRecord) => void
}) {
  const todos: string[] = record.ai_todos ? JSON.parse(record.ai_todos) : []

  return (
    <div
      id={`voice-${record.id}`}
      onClick={() => onClick(record)}
      onContextMenu={(e) => onContextMenu?.(e, record)}
      className={cn(
        "group relative flex flex-col p-3.5 rounded-2xl transition-all duration-200 border cursor-pointer select-none",
        isSelected
          ? "border-primary/50 bg-primary/10 shadow-md ring-1 ring-primary/30"
          : "bg-surface-container hover:bg-surface-container-highest border-outline-variant/20 hover:border-outline-variant/40 shadow-xs"
      )}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn(
            "w-7 h-7 rounded-xl flex items-center justify-center shrink-0",
            record.status === 'done' ? "bg-rose-500/15 text-rose-500" : "bg-surface-container-highest text-on-surface-variant"
          )}>
            <Mic className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold text-on-surface truncate">
            {record.transcript ? record.transcript.slice(0, 24) : `语音录音 #${record.id}`}
          </span>
        </div>
        <span className="text-[10px] text-on-surface-variant/60 font-mono shrink-0">
          {formatDuration(record.duration_seconds)}
        </span>
      </div>

      <div className="flex items-center justify-between mt-2 pt-1 border-t border-outline-variant/10 text-[10px] text-on-surface-variant">
        <div className="flex items-center gap-2">
          <span>{timeLabel(record.created_at)}</span>
          {record.status === 'done' && (
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
              已转写
            </span>
          )}
          {record.status === 'processing' && (
            <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 font-bold animate-pulse">
              转写中
            </span>
          )}
          {todos.length > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold">
              {todos.length} 项待办
            </span>
          )}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); onDelete(record.id) }}
          className="p-1 hover:bg-red-500/10 hover:text-red-500 rounded text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          title="删除录音"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

export function VoicePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [records, setRecords] = useState<VoiceRecord[]>([])
  const [linkedRecord, setLinkedRecord] = useState<VoiceRecord | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<VoiceRecord | null>(null)
  const [linkId, setLinkId] = useState<number | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; record: VoiceRecord } | null>(null)

  // 播放器状态
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackRate, setPlaybackRate] = useState<number>(1.0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const highlight = searchParams.get('highlight')
  const highlightId = linkedTargetId(highlight, 'voice')
  const currentLinkedRecord = linkedTargetFor(highlightId, linkedRecord)
  const visibleRecords = useMemo(
    () => currentLinkedRecord && !records.some(record => record.id === currentLinkedRecord.id) ? [...records, currentLinkedRecord] : records,
    [records, currentLinkedRecord],
  )

  useEffect(() => { setSelectedRecord(null) }, [highlight])

  useEffect(() => {
    if (loading || !highlightId) return
    let cancelled = false
    void ensureLinkedTarget(visibleRecords, highlightId, voiceService.voiceGet).then(({ target }) => {
      if (!cancelled && !visibleRecords.includes(target)) setLinkedRecord(target)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [highlightId, loading, visibleRecords])

  useEffect(() => {
    if (loading || !highlightId || !highlight) return
    const record = visibleRecords.find(item => item.id === highlightId)
    const target = document.getElementById(highlight)
    if (!record || !target) return
    setSelectedRecord(record)
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    target.classList.add('ring-2', 'ring-primary')
    const timer = window.setTimeout(() => target.classList.remove('ring-2', 'ring-primary'), 1800)
    return () => window.clearTimeout(timer)
  }, [highlight, highlightId, loading, visibleRecords])

  const refresh = useCallback(async () => {
    if (!isTauriApp) return
    setLoading(true)
    try {
      const list = await voiceService.voiceList()
      setRecords(list)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const { isRecording, duration, startRecording, stopRecording } = useVoiceRecorder(() => {
    refresh()
  })

  const { transcribingId, transcribeRecord } = useVoiceTranscribe(() => {
    refresh()
  })

  // 播放音频管理
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
      setIsPlaying(false)
    }

    if (selectedRecord?.audio_path && selectedRecord.audio_path.startsWith('data:audio')) {
      const audio = new Audio(selectedRecord.audio_path)
      audio.playbackRate = playbackRate
      audio.onended = () => setIsPlaying(false)
      audioRef.current = audio
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
        audioRef.current = null
      }
    }
  }, [selectedRecord, playbackRate])

  const togglePlayAudio = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play()
      setIsPlaying(true)
    }
  }

  const handleDelete = async (id: number) => {
    await voiceService.voiceDelete(id)
    if (selectedRecord?.id === id) setSelectedRecord(null)
    await refresh()
  }

  const handleCopyTranscription = async (text: string) => {
    await navigator.clipboard.writeText(text)
    playCopySuccessSound()
    showToast('已复制转写文本', 'success')
  }

  const handleCreateTodoFromVoice = async (title: string) => {
    try {
      const newTodo = await todoCreate({
        title,
        priority: 1,
        source: 'voice',
        source_id: selectedRecord?.id,
        tags: ['语音待办'],
      })
      showToast('已成功导入待办清单！', 'success')
      navigate(`/?highlight=todo-${newTodo.id}`)
    } catch (err) {
      showToast(`导入失败: ${String(err)}`, 'error')
    }
  }

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement
      const isInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA'
      if (isInput) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (visibleRecords.length === 0) return
        if (!selectedRecord) {
          setSelectedRecord(visibleRecords[0])
        } else {
          const idx = visibleRecords.findIndex(r => r.id === selectedRecord.id)
          if (idx < visibleRecords.length - 1) setSelectedRecord(visibleRecords[idx + 1])
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (visibleRecords.length === 0) return
        if (!selectedRecord) {
          setSelectedRecord(visibleRecords[visibleRecords.length - 1])
        } else {
          const idx = visibleRecords.findIndex(r => r.id === selectedRecord.id)
          if (idx > 0) setSelectedRecord(visibleRecords[idx - 1])
        }
      } else if (e.key === 'Escape') {
        if (selectedRecord) setSelectedRecord(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [visibleRecords, selectedRecord])

  // 右键菜单项生成
  const contextMenuItems = useMemo((): ContextMenuItem[] => {
    if (!contextMenu) return []
    const { record } = contextMenu

    return [
      {
        key: 'transcribe',
        label: '使用 AI 极速转写',
        icon: RefreshCw,
        onClick: () => transcribeRecord(record.id),
      },
      ...(record.transcript ? [{
        key: 'copy',
        label: '复制转写逐字稿',
        icon: Copy,
        shortcut: '⌘C',
        onClick: () => handleCopyTranscription(record.transcript!),
      }] : []),
      {
        key: 'link',
        label: '关联知识与任务',
        icon: Link2,
        onClick: () => setLinkId(record.id),
      },
      { key: 'sep', label: '', separator: true },
      {
        key: 'delete',
        label: '删除录音',
        icon: Trash2,
        shortcut: '⌫',
        danger: true,
        onClick: () => handleDelete(record.id),
      }
    ]
  }, [contextMenu])

  const parsedTodos: string[] = selectedRecord?.ai_todos ? JSON.parse(selectedRecord.ai_todos) : []

  return (
    <div className="flex flex-col lg:flex-row h-full gap-6 w-full min-w-0 overflow-hidden animate-fade-in">
      
      {/* ── 左栏 Master：支持拖拽调宽的录音时间线 ── */}
      <ResizablePanel
        id="voice"
        defaultWidth={390}
        minWidth={280}
        maxWidth={560}
        className={cn(
          "transition-all duration-300",
          selectedRecord ? "hidden lg:flex" : "flex"
        )}
      >
        {/* 顶部录音快捷条 */}
        <div className="flex items-center justify-between pb-4 border-b border-outline-variant/15 shrink-0 px-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-on-surface">录音备忘历史</span>
            <span className="bg-surface-container px-2 py-0.5 rounded-full text-[10px] font-bold text-on-surface-variant">
              {visibleRecords.length}
            </span>
          </div>

          {/* 快速录音按钮 */}
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs",
              isRecording
                ? "bg-red-500 text-white animate-pulse"
                : "bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20"
            )}
          >
            {isRecording ? <Square className="w-3.5 h-3.5 fill-current" /> : <Mic className="w-3.5 h-3.5" />}
            <span>{isRecording ? formatDuration(duration) : '开始速记'}</span>
          </button>
        </div>

        {/* 录音历史卡片流 */}
        {!loading && (
          visibleRecords.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-4">
              <EmptyState
                icon={<Mic className="w-8 h-8 text-primary" />}
                title="暂无录音记录"
                description="点击右侧大麦克风或上方「开始速记」录制灵感"
              />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto pt-3 pb-8 space-y-3 no-scrollbar">
              {visibleRecords.map(record => (
                <VoiceCard
                  key={record.id}
                  record={record}
                  isSelected={selectedRecord?.id === record.id}
                  onClick={setSelectedRecord}
                  onDelete={handleDelete}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setContextMenu({ x: e.clientX, y: e.clientY, record })
                  }}
                />
              ))}
            </div>
          )
        )}
      </ResizablePanel>

      {/* ── 右栏 Detail：录音大控制台 / 播放与 AI 转写工作台 ── */}
      <div className={cn(
        "flex-1 h-full min-w-0 flex-col overflow-hidden transition-all duration-300",
        selectedRecord ? "flex" : "hidden lg:flex"
      )}>
        {selectedRecord ? (
          <div className="h-full flex flex-col bg-surface-container/60 border border-outline-variant/30 rounded-3xl overflow-hidden backdrop-blur-xl animate-fade-in shadow-xl">
            {/* 顶栏控制 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20 bg-surface/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>录音详情 #{selectedRecord.id}</span>
                </div>
                <span className="text-xs text-on-surface-variant font-mono">
                  {timeLabel(selectedRecord.created_at)} · {formatDuration(selectedRecord.duration_seconds)}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  onClick={() => transcribeRecord(selectedRecord.id)}
                  disabled={transcribingId === selectedRecord.id || selectedRecord.status === 'processing'}
                  variant="secondary"
                  size="sm"
                  className="text-xs gap-1.5"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", transcribingId === selectedRecord.id && "animate-spin")} />
                  <span>{transcribingId === selectedRecord.id ? '转写中...' : '重新转写'}</span>
                </Button>

                <button
                  onClick={() => handleDelete(selectedRecord.id)}
                  className="p-2 text-on-surface-variant hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer"
                  title="删除录音"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setSelectedRecord(null)}
                  className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-xl transition-colors cursor-pointer"
                  title="关闭详情 (Esc)"
                >
                  <Square className="w-4 h-4 opacity-50" />
                </button>
              </div>
            </div>

            {/* 主体工作区 */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
              {/* 音频播放器 */}
              <div className="bg-surface-container-low/90 rounded-2xl p-4 border border-outline-variant/20 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={togglePlayAudio}
                    className="w-12 h-12 rounded-full primary-gradient-button flex items-center justify-center cursor-pointer shadow-md hover:scale-105 transition-transform"
                  >
                    {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                  </button>
                  <div>
                    <div className="text-xs font-bold text-on-surface">录音原声回放</div>
                    <div className="text-[11px] text-on-surface-variant/70 font-mono mt-0.5">
                      时长: {formatDuration(selectedRecord.duration_seconds)}
                    </div>
                  </div>
                </div>

                {/* 倍速控制 */}
                <div className="flex items-center gap-1 bg-surface-container px-2 py-1 rounded-xl border border-outline-variant/20 text-xs font-bold">
                  {[1.0, 1.25, 1.5].map(rate => (
                    <button
                      key={rate}
                      onClick={() => setPlaybackRate(rate)}
                      className={cn(
                        "px-2 py-1 rounded-lg transition-colors cursor-pointer",
                        playbackRate === rate ? "bg-primary text-white" : "text-on-surface-variant hover:text-on-surface"
                      )}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              </div>

              {/* 逐字稿专区 */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" /> AI 逐字稿转写
                  </label>
                  {selectedRecord.transcript && (
                    <button
                      onClick={() => handleCopyTranscription(selectedRecord.transcript!)}
                      className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <Copy className="w-3 h-3" />
                      <span>复制全文</span>
                    </button>
                  )}
                </div>

                <div className="bg-surface-container-low/80 rounded-2xl p-5 border border-outline-variant/20 min-h-[140px]">
                  {selectedRecord.transcript ? (
                    <p className="text-sm leading-relaxed text-on-surface select-text font-normal whitespace-pre-wrap">
                      {selectedRecord.transcript}
                    </p>
                  ) : (
                    <div className="py-8 text-center text-xs text-on-surface-variant/60">
                      暂无转写文本，点击右上角「重新转写」即可使用火山引擎 AI 极速提取
                    </div>
                  )}
                </div>
              </div>

              {/* 提取出的行动项 (Todo) */}
              {parsedTodos.length > 0 && (
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5 px-1">
                    <CheckSquare className="w-3.5 h-3.5 text-primary" /> 提炼出的行动建议 ({parsedTodos.length})
                  </label>
                  <div className="space-y-2">
                    {parsedTodos.map((todoText, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3.5 rounded-xl bg-surface-container-low/80 border border-outline-variant/20 hover:border-outline-variant/40 transition-colors"
                      >
                        <span className="text-xs text-on-surface font-medium truncate flex-1 mr-3">
                          {todoText}
                        </span>
                        <Button
                          onClick={() => handleCreateTodoFromVoice(todoText)}
                          variant="secondary"
                          size="sm"
                          className="shrink-0 text-xs gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>导入待办</span>
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 关联知识入口 */}
              <div className="bg-surface-container-low/80 rounded-2xl p-4 border border-outline-variant/20 flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-xs font-bold text-on-surface">
                  <Link2 className="w-4 h-4 text-primary" />
                  <span>关联知识与文档</span>
                </div>
                <Button onClick={() => setLinkId(selectedRecord.id)} variant="outline" size="sm" className="text-xs">
                  管理关联
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* 未选中任何录音时的录音交互大看板 */
          <div className="h-full flex flex-col justify-between p-8 bg-surface-container/30 border border-outline-variant/20 rounded-3xl backdrop-blur-xl animate-fade-in select-none">
            <div>
              <div className="flex items-center gap-2.5 text-rose-500 mb-2">
                <Mic className="w-5 h-5" />
                <span className="text-xs font-bold tracking-wider uppercase">语音速记与 AI 萃取</span>
              </div>
              <h2 className="text-2xl font-display font-bold text-on-surface">点击录音随时捕捉灵光</h2>
              <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed max-w-md">
                录音完成后，火山引擎 ASR 将全自动生成逐字稿，AI 智能提炼行动待办，支持一键沉淀到 FlowBox 任务流。
              </p>
            </div>

            {/* 居中录音大按钮与波形指示 */}
            <div className="flex flex-col items-center justify-center my-8">
              <div className="relative flex items-center justify-center h-36 w-36">
                {isRecording && (
                  <>
                    <div className="absolute w-44 h-44 bg-red-500/20 rounded-full animate-ping pointer-events-none" style={{ animationDuration: '1.8s' }} />
                    <div className="absolute w-36 h-36 bg-red-500/30 rounded-full animate-pulse pointer-events-none" />
                  </>
                )}

                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={cn(
                    "relative z-10 w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl cursor-pointer hover:scale-105",
                    isRecording ? "bg-red-500 text-white shadow-red-500/40" : "primary-gradient-button shadow-primary/30"
                  )}
                >
                  {isRecording ? <Square className="w-8 h-8 fill-current" /> : <Mic className="w-10 h-10" />}
                </button>
              </div>

              <div className="mt-4 text-center">
                <div className="text-2xl font-mono font-bold text-on-surface">
                  {isRecording ? formatDuration(duration) : '就绪'}
                </div>
                <div className="text-xs text-on-surface-variant/70 mt-1">
                  {isRecording ? '录音中，点击红色方块停止并保存' : '点击麦克风开启语音速记'}
                </div>
              </div>
            </div>

            {/* 底部快捷提示条 */}
            <div className="bg-surface-container-low/80 p-4 rounded-2xl border border-outline-variant/20 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-on-surface-variant">
                <Clock className="w-4 h-4 text-primary" />
                <span>在左侧列表按 <kbd className="font-mono bg-surface-container px-1 py-0.5 rounded border border-outline-variant/30">↑↓</kbd> 切换录音，右键管理</span>
              </div>
              <span className="font-bold text-primary">极速 ASR 驱动</span>
            </div>
          </div>
        )}
      </div>

      {/* 右键上下文菜单 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}

      {linkId !== null && <LinkPanel type="voice" id={linkId} onClose={() => setLinkId(null)} />}
    </div>
  )
}
