import { ObjectId } from 'mongodb'
import { getCollection } from './db'

const BATCH = 500

function dayKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

export async function recomputeBlockIds(
  collectionName: string,
  onProgress?: (current: number, total: number) => void,
): Promise<number> {
  const col = await getCollection(collectionName)
  const all = await col
    .find({}, { projection: { timestamp_ms: 1, sender_name: 1 } })
    .sort({ timestamp_ms: 1 })
    .toArray()

  const ops: unknown[] = []
  let lastDay: string | null = null, lastSender: string | null = null, blockId: ObjectId | null = null

  for (const m of all) {
    const d = dayKey(Number(m.timestamp_ms))
    const grouped = d === lastDay && m.sender_name === lastSender
    if (!grouped) blockId = m._id as ObjectId
    lastDay = d; lastSender = m.sender_name as string
    ops.push({ updateOne: { filter: { _id: m._id }, update: { $set: { blockId } } } })
  }

  for (let i = 0; i < ops.length; i += BATCH) {
    await col.bulkWrite(ops.slice(i, i + BATCH) as Parameters<typeof col.bulkWrite>[0], { ordered: false })
    onProgress?.(Math.min(i + BATCH, ops.length), ops.length)
  }

  return ops.length
}
