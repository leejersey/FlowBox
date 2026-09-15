export function createSettingsNavigation() {
  let pending = false
  let handler: (() => void) | undefined
  let registration: Promise<unknown> | undefined
  const flush = () => {
    if (pending && handler) { pending = false; handler() }
  }
  return {
    request() { pending = true; flush() },
    bind(next: () => void) {
      handler = next
      flush()
      return () => { if (handler === next) handler = undefined }
    },
    async start(subscribe: () => Promise<unknown>, ready: () => Promise<unknown>) {
      registration ??= Promise.resolve().then(subscribe).catch(error => {
        registration = undefined
        throw error
      })
      await registration
      await ready()
    },
  }
}
