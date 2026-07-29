import { ObjectId } from 'mongodb'
import { getHiddenItems } from './db'

let cache: Record<string, unknown> | null = null
let cacheAt = 0
const TTL = 300_000

export function invalidateHiddenFilterCache() {
  cache = null
}

export async function getHiddenMessageFilter(): Promise<Record<string, unknown>> {
  const now = Date.now()
  if (cache !== null && now - cacheAt < TTL) return cache

  const col = await getHiddenItems()
  const hidden = await col.find({ type: 'message' }).project({ value: 1 }).toArray()
  const ids = hidden.map(h => { try { return new ObjectId(h.value) } catch { return null } }).filter(Boolean)
  cache = ids.length ? { _id: { $nin: ids } } : {}
  cacheAt = now
  return cache
}
