import type { Todo, UpdateTodoPayload } from '../types/todo'

export function applyTodoOptimisticUpdate(todos: Todo[], payload: UpdateTodoPayload): Todo[] {
  const { tags, ...fields } = payload
  const patch = Object.fromEntries(
    Object.entries(fields).filter(([key, value]) => key !== 'id' && value !== undefined)
  )
  return todos.map(todo => todo.id === payload.id
    ? { ...todo, ...patch, ...(tags === undefined ? {} : { tags: JSON.stringify(tags) }) }
    : todo)
}

export function rollbackTodoOptimisticUpdate(
  todos: Todo[],
  previousTodos: Todo[],
  id: number,
  optimisticTodo: Todo | undefined,
): Todo[] {
  const previousTodo = previousTodos.find(todo => todo.id === id)
  if (!previousTodo || !optimisticTodo) return todos
  return todos.map(todo => todo.id === id && todo === optimisticTodo ? previousTodo : todo)
}
