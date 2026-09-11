export function finishPomodoro(startedAt: Date, endedAt: Date, interrupted: boolean) {
  return {
    status: interrupted ? 'interrupted' as const : 'completed' as const,
    actualMinutes: Math.round(Math.max(0, endedAt.getTime() - startedAt.getTime()) / 60_000),
  }
}
