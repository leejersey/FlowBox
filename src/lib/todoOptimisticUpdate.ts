const pendingUpdates = new Map<number, Promise<void>>()

export async function updateTodoAndRefresh<T>(
  id: number,
  update: () => Promise<T>,
  refresh: () => Promise<void>,
): Promise<T> {
  const previous = pendingUpdates.get(id) ?? Promise.resolve()
  let release!: () => void
  const current = new Promise<void>(resolve => { release = resolve })
  pendingUpdates.set(id, current)

  await previous
  try {
    const todo = await update()
    await refresh()
    return todo
  } finally {
    release()
    if (pendingUpdates.get(id) === current) pendingUpdates.delete(id)
  }
}
