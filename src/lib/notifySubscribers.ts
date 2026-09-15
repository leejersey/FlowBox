export function notifySubscribers<T>(
  callbacks: Set<(value: T) => void>,
  createValue: () => T,
): void {
  for (const callback of [...callbacks]) {
    try {
      callback(createValue())
    } catch (error) {
      console.error('Pomodoro subscriber failed', error)
    }
  }
}
