export interface PhysicalGeometry {
  size: { width: number; height: number }
  position: { x: number; y: number }
}

export interface WindowSnapshot extends PhysicalGeometry {
  resizable: boolean
  alwaysOnTop: boolean
  maximized: boolean
}

export interface MiniWindowAdapter {
  innerPhysicalSize(): Promise<PhysicalGeometry['size']>
  outerPhysicalPosition(): Promise<PhysicalGeometry['position']>
  isResizable(): Promise<boolean>
  isAlwaysOnTop(): Promise<boolean>
  isMaximized(): Promise<boolean>
  setLogicalSize(width: number, height: number): Promise<void>
  setPhysicalSize(size: PhysicalGeometry['size']): Promise<void>
  setPhysicalPosition(position: PhysicalGeometry['position']): Promise<void>
  setResizable(value: boolean): Promise<void>
  setAlwaysOnTop(value: boolean): Promise<void>
  maximize(): Promise<void>
  unmaximize(): Promise<void>
}

type Undo = () => Promise<void>

async function undoAll(undo: Undo[]): Promise<unknown[]> {
  const errors: unknown[] = []
  for (const action of [...undo].reverse()) {
    try { await action() } catch (error) { errors.push(error) }
  }
  return errors
}

class WindowRollbackError extends AggregateError {
  readonly retryRollback: Undo

  constructor(error: unknown, errors: unknown[], undo: Undo[]) {
    super([error, ...errors], 'Window transaction failed; rollback also failed', { cause: error })
    this.retryRollback = async () => {
      const remaining = await undoAll(undo)
      if (remaining.length) throw new WindowRollbackError(error, remaining, undo)
    }
  }
}

async function rollbackAndThrow(error: unknown, undo: Undo[]): Promise<never> {
  const errors = await undoAll(undo)
  if (errors.length) throw new WindowRollbackError(error, errors, undo)
  throw error
}

/** Maximized windows must expose their normal physical geometry before capture. */
export async function captureWindowSnapshot(adapter: MiniWindowAdapter): Promise<WindowSnapshot> {
  const maximized = await adapter.isMaximized()
  const resizable = await adapter.isResizable()
  const alwaysOnTop = await adapter.isAlwaysOnTop()
  const undo: Undo[] = []
  try {
    if (maximized) {
      undo.push(() => adapter.maximize())
      await adapter.unmaximize()
    }
    const size = { ...await adapter.innerPhysicalSize() }
    const position = { ...await adapter.outerPhysicalPosition() }
    return { size, position, resizable, alwaysOnTop, maximized }
  } catch (error) {
    return rollbackAndThrow(error, undo)
  }
}

/** A supplied snapshot has already unmaximized the window during capture. */
export async function enterMiniWindow(adapter: MiniWindowAdapter, captured?: WindowSnapshot): Promise<WindowSnapshot> {
  const snapshot = captured ?? await captureWindowSnapshot(adapter)
  const undo: Undo[] = snapshot.maximized ? [() => adapter.maximize()] : []
  try {
    // Register inverses before setters: an adapter may mutate and then reject.
    undo.push(() => adapter.setPhysicalPosition(snapshot.position), () => adapter.setPhysicalSize(snapshot.size))
    await adapter.setLogicalSize(340, 160)
    undo.push(() => adapter.setResizable(snapshot.resizable))
    await adapter.setResizable(false)
    undo.push(() => adapter.setAlwaysOnTop(snapshot.alwaysOnTop))
    await adapter.setAlwaysOnTop(true)
    return snapshot
  } catch (error) {
    return rollbackAndThrow(error, undo)
  }
}

/** Restore atomically where possible; a failed manual exit can be retried. */
export async function restoreWindow(adapter: MiniWindowAdapter, snapshot: WindowSnapshot): Promise<void> {
  const previous = await captureWindowSnapshot(adapter)
  const undo: Undo[] = previous.maximized ? [() => adapter.maximize()] : []
  try {
    undo.push(() => adapter.setPhysicalPosition(previous.position), () => adapter.setPhysicalSize(previous.size))
    await adapter.setPhysicalSize(snapshot.size)
    await adapter.setPhysicalPosition(snapshot.position)
    undo.push(() => adapter.setResizable(previous.resizable))
    await adapter.setResizable(snapshot.resizable)
    undo.push(() => adapter.setAlwaysOnTop(previous.alwaysOnTop))
    await adapter.setAlwaysOnTop(snapshot.alwaysOnTop)
    if (snapshot.maximized) {
      undo.push(() => adapter.unmaximize())
      await adapter.maximize()
    }
  } catch (error) {
    return rollbackAndThrow(error, undo)
  }
}

type DesiredMode = 'normal' | 'mini'
type NativeMode = DesiredMode | 'entering' | 'exiting'

export function createMiniWindowController(adapter: MiniWindowAdapter) {
  let mode: NativeMode = 'normal'
  let desired: DesiredMode = 'normal'
  let generation = 0
  let snapshot: WindowSnapshot | null = null
  let recovery: Undo | null = null
  let queue: Promise<unknown> = Promise.resolve()
  const getState = () => ({ mode, desired, generation })

  async function reconcile() {
    for (;;) {
      const currentGeneration = generation
      if (mode === 'exiting' || (desired === 'normal' && snapshot)) {
        mode = 'exiting'
        if (snapshot) await restoreWindow(adapter, snapshot)
        else if (recovery) await recovery()
        snapshot = null
        recovery = null
        mode = 'normal'
      }
      if (desired === 'mini' && mode === 'normal') {
        mode = 'entering'
        try {
          snapshot = await captureWindowSnapshot(adapter)
          // An exit can arrive while getters/unmaximize are pending.
          if (getState().desired === 'normal') {
            mode = 'exiting'
            await restoreWindow(adapter, snapshot)
            snapshot = null
            mode = 'normal'
          } else {
            await enterMiniWindow(adapter, snapshot)
            mode = 'mini'
          }
        } catch (error) {
          if (mode === 'exiting' || error instanceof WindowRollbackError) {
            mode = 'exiting'
            if (!snapshot && error instanceof WindowRollbackError) recovery = error.retryRollback
          } else {
            snapshot = null
            mode = 'normal'
          }
          throw error
        }
      }
      if (currentGeneration === generation) return getState()
    }
  }

  function request(next: DesiredMode) {
    desired = next
    generation += 1
    const result = queue.then(reconcile)
    queue = result.catch(() => { /* One failed transaction must not poison later intents. */ })
    return result
  }

  return {
    enter: () => request('mini'),
    exit: () => request('normal'),
    forceExit: () => request('normal'),
    getState,
  }
}
