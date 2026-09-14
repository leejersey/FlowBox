/**
 * FlowBox 桌面原生触感音效库 (Web Audio API 合成，零外部文件依赖)
 */

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (AudioContextClass) {
      audioCtx = new AudioContextClass()
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

export function isSoundMuted(): boolean {
  try {
    return localStorage.getItem('flowbox_sound_muted') === 'true'
  } catch {
    return false
  }
}

export function toggleSoundMute(): boolean {
  const current = isSoundMuted()
  const next = !current
  localStorage.setItem('flowbox_sound_muted', String(next))
  return next
}

/** 任务打勾完成音效：清脆水滴微铃 */
export function playTaskCompleteSound() {
  if (isSoundMuted()) return
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  const osc1 = ctx.createOscillator()
  const osc2 = ctx.createOscillator()
  const gain = ctx.createGain()

  osc1.type = 'sine'
  osc2.type = 'triangle'

  // 和弦频率上升：880Hz (A5) -> 1318.5Hz (E6)
  osc1.frequency.setValueAtTime(880, now)
  osc1.frequency.exponentialRampToValueAtTime(1318.5, now + 0.12)
  osc2.frequency.setValueAtTime(1046.5, now)
  osc2.frequency.exponentialRampToValueAtTime(1760, now + 0.12)

  // 柔和音量衰减曲线
  gain.gain.setValueAtTime(0.12, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28)

  osc1.connect(gain)
  osc2.connect(gain)
  gain.connect(ctx.destination)

  osc1.start(now)
  osc2.start(now)
  osc1.stop(now + 0.3)
  osc2.stop(now + 0.3)
}

/** 专注番茄钟归零完成音效：温暖颂钵钟声 */
export function playPomodoroDoneSound() {
  if (isSoundMuted()) return
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'sine'
  osc.frequency.setValueAtTime(528, now) // 528Hz 舒缓频率
  osc.frequency.exponentialRampToValueAtTime(524, now + 1.5)

  gain.gain.setValueAtTime(0.18, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(now)
  osc.stop(now + 1.8)
}

/** 复制成功微轻触反馈 */
export function playCopySuccessSound() {
  if (isSoundMuted()) return
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'sine'
  osc.frequency.setValueAtTime(1200, now)
  gain.gain.setValueAtTime(0.08, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(now)
  osc.stop(now + 0.08)
}
