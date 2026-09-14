export type LinkableType = 'todo' | 'idea' | 'voice' | 'clipboard'

export interface ItemLink {
  id: number
  source_type: LinkableType
  source_id: number
  target_type: LinkableType
  target_id: number
  created_at: string
}

interface LinkDatabase {
  execute(sql: string, params: unknown[]): Promise<unknown>
  select<T>(sql: string, params: unknown[]): Promise<T>
}

export async function ensureLinkedTarget<T extends { id: number }>(
  items: T[],
  id: number,
  load: (id: number) => Promise<T>
): Promise<{ items: T[]; target: T }> {
  const existing = items.find(item => item.id === id)
  if (existing) return { items, target: existing }
  const target = await load(id)
  return { items: [...items, target], target }
}

export function linkedTargetId(highlight: string | null, type: LinkableType): number | null {
  const match = highlight?.match(new RegExp(`^${type}-([1-9]\\d*)$`))
  if (!match) return null
  const id = Number(match[1])
  return Number.isSafeInteger(id) ? id : null
}

export function linkedTargetFor<T extends { id: number }>(highlightId: number | null, item: T | null): T | null {
  return item?.id === highlightId ? item : null
}

export function canonicalizeLink(
  aType: LinkableType,
  aId: number,
  bType: LinkableType,
  bId: number
) {
  const a = { type: aType, id: aId }
  const b = { type: bType, id: bId }
  const aFirst = a.type < b.type || (a.type === b.type && a.id <= b.id)
  const [source, target] = aFirst ? [a, b] : [b, a]
  if (source.type === target.type && source.id === target.id) throw new Error('不能关联自身')
  return {
    sourceType: source.type,
    sourceId: source.id,
    targetType: target.type,
    targetId: target.id,
  }
}

export async function createOrGetLink(
  db: LinkDatabase,
  aType: LinkableType,
  aId: number,
  bType: LinkableType,
  bId: number
): Promise<ItemLink> {
  const link = canonicalizeLink(aType, aId, bType, bId)
  const params = [link.sourceType, link.sourceId, link.targetType, link.targetId]
  await db.execute(
    `INSERT OR IGNORE INTO item_links (source_type, source_id, target_type, target_id, created_at)
     VALUES (?1, ?2, ?3, ?4, datetime('now'))`,
    params
  )
  const rows = await db.select<ItemLink[]>(
    `SELECT * FROM item_links
     WHERE source_type = ?1 AND source_id = ?2 AND target_type = ?3 AND target_id = ?4`,
    params
  )
  if (!rows[0]) throw new Error('关联创建失败')
  return rows[0]
}
