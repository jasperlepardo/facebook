import { getHiddenItems, getHiddenSync } from './db'

const SYNC_ID = 'global'

export async function bumpHiddenSyncVersion(): Promise<number> {
  const col = await getHiddenSync()
  const res = await col.findOneAndUpdate(
    { _id: SYNC_ID },
    { $inc: { version: 1 } },
    { upsert: true, returnDocument: 'after' },
  )
  return res?.version ?? 1
}

export async function getHiddenSyncVersion(): Promise<number> {
  const col = await getHiddenSync()
  const doc = await col.findOne({ _id: SYNC_ID })
  return doc?.version ?? 0
}

export async function getHiddenSnapshot(): Promise<{
  version: number
  messageIds: string[]
  uris: string[]
}> {
  const [version, itemsCol] = await Promise.all([getHiddenSyncVersion(), getHiddenItems()])
  const items = await itemsCol.find({}, { projection: { type: 1, value: 1 } }).toArray()
  return {
    version,
    messageIds: items.filter(i => i.type === 'message').map(i => i.value),
    uris: items.filter(i => i.type === 'uri').map(i => i.value),
  }
}
