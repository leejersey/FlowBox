export function finishPomodoro(startedAt: Date, endedAt: Date, interrupted: boolean) {
  return {
    status: interrupted ? 'interrupted' as const : 'completed' as const,
    actualMinutes: Math.round(Math.max(0, endedAt.getTime() - startedAt.getTime()) / 60_000),
  }
}

export function finishPomodoroFromElapsed(elapsedSeconds: number, totalSeconds: number, interrupted: boolean) {
  const activeSeconds = Math.min(Math.max(0, elapsedSeconds), Math.max(0, totalSeconds))
  return {
    status: interrupted ? 'interrupted' as const : 'completed' as const,
    actualMinutes: Math.round(activeSeconds / 60),
  }
}

export const RECOVER_RUNNING_SESSIONS_SQL = `UPDATE pomodoro_sessions
SET status = 'interrupted', ended_at = $1,
    actual_minutes = CAST(MIN(
      MAX(0, COALESCE(duration_minutes, 0)),
      MAX(0, COALESCE(ROUND((julianday($1) - julianday(started_at)) * 1440), 0))
    ) AS INTEGER)
WHERE status = 'running'`
