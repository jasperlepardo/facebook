import { getPayloadClient } from './payload-access'

interface UpsertThreadParams {
  collectionName:    string
  threadName:        string
  participants:      string[]
  facebookThreadId?: string
  initials?:         string
  color?:            string
  total:             number
}

export async function upsertThread({
  collectionName, threadName, participants, facebookThreadId, initials, color, total,
}: UpsertThreadParams): Promise<void> {
  try {
    const payload  = await getPayloadClient()
    const existing = await payload.find({
      collection: 'threads',
      where: { collection: { equals: collectionName } },
      limit: 2, depth: 0, overrideAccess: true,
    })

    const data = {
      name:             threadName,
      collection:       collectionName,
      initials:         initials ?? threadName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
      color:            (color ?? 'bg-rose-400') as 'bg-rose-400' | 'bg-violet-400' | 'bg-amber-400' | 'bg-sky-400' | 'bg-pink-400' | 'bg-indigo-400' | 'bg-emerald-400' | 'bg-orange-400',
      facebookThreadId: facebookThreadId ?? '',
      participants:     participants.map(name => ({ name })),
      messageCount:     total,
    }

    if (existing.totalDocs > 0) {
      await payload.update({ collection: 'threads', id: existing.docs[0].id, data: { messageCount: total }, overrideAccess: true })
      for (const dup of existing.docs.slice(1)) {
        await payload.delete({ collection: 'threads', id: dup.id, overrideAccess: true }).catch(() => {})
      }
    } else {
      await payload.create({ collection: 'threads', data, overrideAccess: true })
    }
  } catch (e) {
    console.error('upsertThread error:', e)
  }
}
