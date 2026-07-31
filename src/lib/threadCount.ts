import { getPayloadClient } from './payload-access'
import { getCollection } from './db'

const cache = new Map<string, { count: number; at: number }>()
const TTL = 60_000

/** Cheap message total: Threads.messageCount, else estimatedDocumentCount. */
export async function getThreadMessageCount(collectionName: string): Promise<number> {
  const cached = cache.get(collectionName)
  if (cached && Date.now() - cached.at < TTL) return cached.count

  try {
    const payload = await getPayloadClient()
    const found = await payload.find({
      collection: 'threads',
      where: { collection: { equals: collectionName } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const fromThread = found.docs[0]?.messageCount
    if (typeof fromThread === 'number' && fromThread >= 0) {
      cache.set(collectionName, { count: fromThread, at: Date.now() })
      return fromThread
    }
  } catch {
    // fall through to estimate
  }

  const col = await getCollection(collectionName)
  const estimated = await col.estimatedDocumentCount()
  cache.set(collectionName, { count: estimated, at: Date.now() })
  return estimated
}

export function invalidateThreadMessageCount(collectionName: string) {
  cache.delete(collectionName)
}
