import { getPayloadClient } from './payload-access'
import { getCollection } from './db'
import { defaultThreadName } from './threadDisplay'
import {
  backfillMessageSenderIds,
  extractLegacyParticipantRows,
  isLegacyEmbeddedParticipants,
  migrateThreadParticipantsToRelations,
  upsertParticipants,
} from './participantUtils'

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
  collectionName, threadName, participants, facebookThreadId, total,
}: UpsertThreadParams): Promise<void> {
  try {
    const payload  = await getPayloadClient()
    const existing = await payload.find({
      collection: 'threads',
      where: { collection: { equals: collectionName } },
      limit: 2, depth: 0, overrideAccess: true,
    })

    // Include senders present in messages but missing from the export participants list.
    const col = await getCollection(collectionName)
    const senderNames = (await col.distinct('sender_name') as string[]).filter(Boolean)
    const allNames = [...new Set([...participants, ...senderNames])]

    const { participants: rows } = await upsertParticipants(allNames)
    const ids = rows.map(p => p.id)
    const fallbackName = defaultThreadName(allNames)
    const resolvedName = (threadName || '').trim() || fallbackName

    if (existing.totalDocs > 0) {
      const doc = existing.docs[0]
      // Migrate legacy embedded rows if still present (styles preserved inside migrate).
      if (isLegacyEmbeddedParticipants(doc.participants)) {
        await migrateThreadParticipantsToRelations(
          String(doc.id),
          extractLegacyParticipantRows(doc.participants),
        )
        await payload.update({
          collection: 'threads',
          id: doc.id,
          data: { messageCount: total, participants: ids },
          overrideAccess: true,
        })
      } else {
        await payload.update({
          collection: 'threads',
          id: doc.id,
          data: {
            messageCount: total,
            participants: ids,
          },
          overrideAccess: true,
        })
      }
      for (const dup of existing.docs.slice(1)) {
        await payload.delete({ collection: 'threads', id: dup.id, overrideAccess: true }).catch(() => {})
      }
    } else {
      await payload.create({
        collection: 'threads',
        data: {
          name:             resolvedName,
          collection:       collectionName,
          facebookThreadId: facebookThreadId ?? '',
          participants:     ids,
          messageCount:     total,
        },
        overrideAccess: true,
      })
    }

    await backfillMessageSenderIds(collectionName)
  } catch (e) {
    console.error('upsertThread error:', e)
  }
}
