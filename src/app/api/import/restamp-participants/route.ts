import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload-access'
import { isSafeCollectionName } from '@/lib/db'
import { restampThread } from '@/lib/participantUtils'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS })
}

/**
 * Restamp all threads: migrate legacy embedded participants → relationship IDs
 * and backfill message.senderId from sender_name.
 */
export async function POST() {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status, headers: CORS })

  try {
    const payload = await getPayloadClient()
    const result = await payload.find({
      collection: 'threads',
      limit: 500,
      depth: 0,
      overrideAccess: true,
    })

    const threads: { collection: string; participants: number; messagesUpdated: number }[] = []
    let messagesUpdated = 0

    for (const doc of result.docs) {
      const collection = typeof doc.collection === 'string' ? doc.collection : ''
      if (!collection || !isSafeCollectionName(collection)) continue
      const out = await restampThread(collection, {
        threadId: String(doc.id),
        legacyParticipants: doc.participants,
      })
      messagesUpdated += out.messagesUpdated
      threads.push({
        collection,
        participants: out.participants.length,
        messagesUpdated: out.messagesUpdated,
      })
    }

    return NextResponse.json({
      threads: threads.length,
      messagesUpdated,
      details: threads,
    }, { headers: CORS })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}
