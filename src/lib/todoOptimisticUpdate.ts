export async function updateTodoAndRefresh<T>(
  update: () => Promise<T>,
  refresh: () => Promise<void>,
): Promise<T> {
  const todo = await update()
  await refresh()
  return todo
}
