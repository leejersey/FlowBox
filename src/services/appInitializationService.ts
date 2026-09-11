export type InitializationStep = [string, () => Promise<unknown>]

let mainInitialization: Promise<{ failures: string[] }> | undefined

export function initializeAppWindow(
  label: string,
  steps: InitializationStep[],
  onFailure: (failure: { name: string; error: unknown }) => void = () => {},
) {
  if (label !== 'main') return Promise.resolve({ failures: [] })

  return mainInitialization ??= (async () => {
    const failures: string[] = []
    for (const [name, step] of steps) {
      try {
        await step()
      } catch (error) {
        failures.push(name)
        onFailure({ name, error })
      }
    }
    return { failures }
  })()
}

export const shouldPersistUsageTick = (label: string) => label === 'main'

export function registerMainWindowListener(
  label: string,
  subscribe: () => Promise<() => void>,
  onError: (error: unknown) => void = () => {},
) {
  let cancelled = false
  let unlisten: (() => void) | undefined

  if (label === 'main') {
    try {
      void subscribe().then(
        fn => cancelled ? fn() : (unlisten = fn),
        error => { if (!cancelled) onError(error) },
      )
    } catch (error) {
      onError(error)
    }
  }

  return () => {
    cancelled = true
    unlisten?.()
  }
}
