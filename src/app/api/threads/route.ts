import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload-access'
import { requireSuperAdmin } from '@/lib/auth'
import type { ThreadParticipant } from '@/types'
import {
  ALLOWED_PARTICIPANT_COLORS,
  initialsFromName,
  isLegacyEmbeddedParticipants,
  mapRelationParticipants,
  restampThread,
} from '@/lib/participantUtils'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
}

// Threads change only when imported or renamed — 60s TTL is plenty
let threadsCache: { data: { threads: ReturnType<typeof dedupeThreads> }; at: number } | null = null
const THREADS_TTL = 60_000

export function invalidateThreadsCache() {
  threadsCache = null
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS })
}

export async function GET() {
  const now = Date.now()
  if (threadsCache && now - threadsCache.at < THREADS_TTL) {
    return NextResponse.json(threadsCache.data, { headers: CORS })
  }

  try {
    const payload = await getPayloadClient()
    const result  = await payload.find({
      collection: 'threads',
      limit: 100,
      sort: 'name',
      depth: 1,
      overrideAccess: true,
    })
    const threads = []
    for (const doc of result.docs) {
      threads.push(await mapThreadDoc(doc))
    }
    const data = { threads: dedupeThreads(threads) }
    threadsCache = { data, at: now }
    return NextResponse.json(data, { headers: CORS })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}

/** PATCH thread name and/or a participant's initials/color — superAdmin only */
export async function PATCH(req: NextRequest) {
  const gate = await requireSuperAdmin()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status, headers: CORS })
  }

  try {
    const body = await req.json() as {
      collection?: string
      name?: string
      participantId?: string
      participantName?: string
      initials?: string
      color?: string
    }
    const collection = body.collection?.trim()
    if (!collection) {
      return NextResponse.json({ error: 'collection required' }, { status: 400, headers: CORS })
    }

    const payload = await getPayloadClient()
    const found = await payload.find({
      collection: 'threads',
      where: { collection: { equals: collection } },
      limit: 1,
      depth: 1,
      overrideAccess: true,
    })
    const doc = found.docs[0]
    if (!doc) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404, headers: CORS })
    }

    // Ensure relationships (migrate legacy if needed) before editing members.
    const mapped = await mapThreadDoc(doc)
    const participants = mapped.participants ?? []

    const data: Record<string, unknown> = {}

    if (typeof body.name === 'string') {
      const name = body.name.trim()
      if (!name) return NextResponse.json({ error: 'name cannot be empty' }, { status: 400, headers: CORS })
      data.name = name
    }

    if (typeof body.participantName === 'string' || typeof body.participantId === 'string') {
      const participantName = body.participantName?.trim()
      const participantId = body.participantId?.trim()
      const member = participants.find(p =>
        (participantId && p.id === participantId) ||
        (participantName && p.name === participantName),
      )
      if (!member?.id) {
        return NextResponse.json({ error: 'Participant not found' }, { status: 404, headers: CORS })
      }
      const participantData: Record<string, unknown> = {}
      if (typeof body.initials === 'string') {
        participantData.initials = body.initials.trim().slice(0, 2).toUpperCase() || initialsFromName(member.name)
      }
      if (typeof body.color === 'string') {
        if (!ALLOWED_PARTICIPANT_COLORS.has(body.color)) {
          return NextResponse.json({ error: 'invalid color' }, { status: 400, headers: CORS })
        }
        participantData.color = body.color
      }
      if (!Object.keys(participantData).length) {
        return NextResponse.json({ error: 'initials or color required' }, { status: 400, headers: CORS })
      }
      await payload.update({
        collection: 'participants',
        id: member.id,
        data: participantData,
        overrideAccess: true,
      })
    }

    let updated = doc
    if (Object.keys(data).length) {
      updated = await payload.update({
        collection: 'threads',
        id: String(doc.id),
        data,
        depth: 1,
        overrideAccess: true,
      })
    } else {
      // Re-fetch populated thread after participant edit
      updated = await payload.findByID({
        collection: 'threads',
        id: String(doc.id),
        depth: 1,
        overrideAccess: true,
      })
    }

    invalidateThreadsCache()
    return NextResponse.json({
      thread: await mapThreadDoc(updated),
    }, { headers: CORS })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}

async function mapThreadDoc(t: {
  id: string | number
  name?: string
  collection?: string
  facebookThreadId?: string | null
  participants?: unknown
  messageCount?: number | null
}): Promise<{
  id: string
  name: string
  collection: string
  facebookThreadId: string | null
  participants: ThreadParticipant[]
  messageCount: number
}> {
  let participants: ThreadParticipant[] = []

  if (isLegacyEmbeddedParticipants(t.participants)) {
    const collection = t.collection ?? ''
    const { participants: migrated } = await restampThread(collection, {
      threadId: String(t.id),
      legacyParticipants: t.participants,
    })
    participants = migrated.map(p => ({
      id: p.id,
      name: p.name,
      initials: p.initials,
      color: p.color,
    }))
  } else {
    let rows = mapRelationParticipants(t.participants)
    // depth 0 leftover: string ids only
    if (rows.length === 0 && Array.isArray(t.participants) && t.participants.length > 0
      && t.participants.every(p => typeof p === 'string' || typeof p === 'number')) {
      const payload = await getPayloadClient()
      const ids = t.participants.map(String)
      const found = await payload.find({
        collection: 'participants',
        where: { id: { in: ids } },
        limit: ids.length,
        depth: 0,
        overrideAccess: true,
      })
      rows = mapRelationParticipants(found.docs)
    }
    // Empty / broken — try distinct nothing; leave empty
    if (rows.length === 0 && Array.isArray(t.participants) && t.participants.length === 0) {
      participants = []
    } else {
      participants = rows.map(p => ({
        id: p.id,
        name: p.name,
        initials: p.initials,
        color: p.color,
      }))
    }
  }

  return {
    id:               String(t.id),
    name:             t.name ?? '',
    collection:       t.collection ?? '',
    facebookThreadId: t.facebookThreadId ?? null,
    participants,
    messageCount:     t.messageCount ?? 0,
  }
}

function dedupeThreads<T extends { collection: string }>(threads: T[]): T[] {
  const seen = new Set<string>()
  return threads.filter(t => {
    if (seen.has(t.collection)) return false
    seen.add(t.collection)
    return true
  })
}
