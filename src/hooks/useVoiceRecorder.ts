import { useState, useRef, useCallback, useEffect } from 'react'
import { invoke, isTauri } from '@tauri-apps/api/core'
import * as voiceService from '@/services/voiceService'
import { showToast } from '@/store/useToastStore'

type LegacyGetUserMedia = (
  constraints: MediaStreamConstraints,
  onSuccess: (stream: MediaStream) => void,
  onError?: (error: DOMException) => void
) => void

interface LegacyNavigator extends Navigator {
  webkitGetUserMedia?: LegacyGetUserMedia
  mozGetUserMedia?: LegacyGetUserMedia
  msGetUserMedia?: LegacyGetUserMedia
}

interface NativeVoiceRecordingResult {
  dataUrl: string
}

const isTauriApp = isTauri()

// A utility to convert a Blob (audio) to a Base64 string
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      // FileReader results in a Data URL. We store it as is or split it.
      // Storing as data URL: "data:audio/webm;codecs=opus;base64,..."
      resolve(reader.result as string)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function getMicrophoneErrorMessage(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === 'NotSupportedError') {
      return '当前环境不支持麦克风录音（麦克风 API 不可用）。'
    }
    if (err.name === 'NotAllowedError') {
      return '麦克风权限被拒绝。请到「系统设置 > 隐私与安全性 > 麦克风」允许 FlowBox。'
    }
    if (err.name === 'NotFoundError') {
      return '未检测到可用麦克风设备。'
    }
    if (err.name === 'NotReadableError') {
      return '麦克风正在被其他应用占用或系统限制访问。'
    }
    if (err.name === 'SecurityError') {
      return '当前环境安全策略阻止了麦克风访问。'
    }
    if (err.message) {
      return `麦克风访问失败: ${err.message}`
    }
  }

  return `麦克风访问失败: ${String(err)}`
}

function requestAudioStream(): Promise<MediaStream> {
  if (navigator.mediaDevices?.getUserMedia) {
    return navigator.mediaDevices.getUserMedia({ audio: true })
  }

  const legacyNavigator = navigator as LegacyNavigator
  const legacyGetUserMedia =
    legacyNavigator.webkitGetUserMedia ??
    legacyNavigator.mozGetUserMedia ??
    legacyNavigator.msGetUserMedia

  if (!legacyGetUserMedia) {
    throw new DOMException('getUserMedia is unavailable', 'NotSupportedError')
  }

  return new Promise((resolve, reject) => {
    legacyGetUserMedia.call(
      legacyNavigator,
      { audio: true },
      resolve,
      (error) => reject(error ?? new DOMException('Legacy getUserMedia failed', 'NotReadableError'))
    )
  })
}

export function useVoiceRecorder(onRecordComplete?: () => void) {
  const [isRecording, setIsRecording] = useState(false)
  const [duration, setDuration] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)
  const durationRef = useRef(0)
  const recordingModeRef = useRef<'native' | 'web' | null>(null)

  const startDurationTimer = useCallback(() => {
    durationRef.current = 0
    setDuration(0)

    if (timerRef.current) {
      clearInterval(timerRef.current)
    }

    timerRef.current = window.setInterval(() => {
      durationRef.current += 1
      setDuration(durationRef.current)
    }, 1000)
  }, [])

  const clearDurationTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const persistRecording = useCallback(async (audioDataUrl: string, durationSeconds: number) => {
    await voiceService.voiceCreate(audioDataUrl, durationSeconds)
    showToast('录音保存成功，正在后台转写...', 'success')

    if (onRecordComplete) {
      onRecordComplete()
    }
  }, [onRecordComplete])

  const startRecording = useCallback(async () => {
    try {
      if (isTauriApp) {
        await invoke('voice_start_recording')
        recordingModeRef.current = 'native'
        setIsRecording(true)
        startDurationTimer()
        return
      }

      if (typeof MediaRecorder === 'undefined') {
        showToast('当前环境不支持麦克风录音（MediaRecorder 不可用）', 'error')
        return
      }

      const stream = await requestAudioStream()
      const mediaRecorder = new MediaRecorder(stream)

      recordingModeRef.current = 'web'
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        // Build the final audio Blob
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })

        try {
          const base64Audio = await blobToBase64(audioBlob)
          await persistRecording(base64Audio, durationRef.current)
        } catch (err) {
          showToast(`保存录音失败: ${String(err)}`, 'error')
        } finally {
          stream.getTracks().forEach(track => track.stop())
          mediaRecorderRef.current = null
          recordingModeRef.current = null
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
      startDurationTimer()

    } catch (err) {
      showToast(getMicrophoneErrorMessage(err), 'error')
    }
  }, [persistRecording, startDurationTimer])

  const stopRecording = useCallback(() => {
    if (!isRecording) {
      return
    }

    clearDurationTimer()
    setIsRecording(false)

    if (recordingModeRef.current === 'native') {
      invoke<NativeVoiceRecordingResult>('voice_stop_recording')
        .then(async (result) => {
          await persistRecording(result.dataUrl, durationRef.current)
        })
        .catch((err) => {
          showToast(`停止录音失败: ${String(err)}`, 'error')
        })
        .finally(() => {
          recordingModeRef.current = null
        })
      return
    }

    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
    }
  }, [clearDurationTimer, isRecording, persistRecording])

  useEffect(() => {
    return () => {
      clearDurationTimer()

      if (recordingModeRef.current === 'native') {
        invoke('voice_stop_recording').catch(() => {})
      } else if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
    }
  }, [clearDurationTimer])

  return {
    isRecording,
    duration,
    startRecording,
    stopRecording
  }
}
