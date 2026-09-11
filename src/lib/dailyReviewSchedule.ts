export function shouldTriggerDailyReview(now: Date, value: string, alreadyShown: boolean): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (alreadyShown || !match) return false
  const hour = Number(match[1]), minute = Number(match[2])
  return hour < 24 && minute < 60 && now.getHours() * 60 + now.getMinutes() >= hour * 60 + minute
}
