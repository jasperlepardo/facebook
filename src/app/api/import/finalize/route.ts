import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getCollection } from '@/lib/db'
import { getPayloadClient } from '@/lib/payload-access'
import { getSession } from '@/lib/session'

const CORS  = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const BATCH = 500

export const maxDuration = 300
export const dynamic     = 'force-dynamic'

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS })

  const { collection: collectionName, threadName, participants, facebookThreadId, initials, color } = await req.json()
  if (!collectionName) return NextResponse.json({ error: 'collection required' }, { status: 400, headers: CORS })

  const col = await getCollection(collectionName)
  const enc = new TextEncoder()

  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (data: object) => ctrl.enqueue(enc.encode(JSON.stringify(data) + '\n'))

      try {
        // ── Recompute blockIds ──────────────────────────────────────────────────
        const all = await col
          .find({}, { projection: { timestamp_ms: 1, sender_name: 1 } })
          .sort({ timestamp_ms: 1 })
          .toArray()

        const ops: unknown[] = []
        let lastDay: string | null = null, lastSender: string | null = null
        let blockId: ObjectId | null = null

        for (const m of all) {
          const d = new Date(Number(m.timestamp_ms))
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
          const grouped = key === lastDay && m.sender_name === lastSender
          if (!grouped) blockId = m._id as ObjectId
          lastDay = key; lastSender = m.sender_name as string
          ops.push({ updateOne: { filter: { _id: m._id }, update: { $set: { blockId } } } })
        }

        for (let i = 0; i < ops.length; i += BATCH) {
          await col.bulkWrite(ops.slice(i, i + BATCH) as Parameters<typeof col.bulkWrite>[0], { ordered: false })
          send({ type: 'blockids', current: Math.min(i + BATCH, ops.length), total: ops.length })
        }

        // ── Upsert thread ───────────────────────────────────────────────────────
        const total = await col.countDocuments()
        try {
          const payload = await getPayloadClient()
          const existing = await payload.find({
            collection: 'threads',
            where: { collection: { equals: collectionName } },
            limit: 1, depth: 0, overrideAccess: true,
          })
          const data = {
            name: threadName, collection: collectionName,
            initials: initials ?? threadName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
            color: (color ?? 'bg-rose-400') as any,
            facebookThreadId: facebookThreadId ?? '',
            participants: (participants ?? []).map((name: string) => ({ name })),
            messageCount: total,
          }
          if (existing.totalDocs > 0) {
            await payload.update({ collection: 'threads', id: existing.docs[0].id, data: { messageCount: total }, overrideAccess: true })
          } else {
            await payload.create({ collection: 'threads', data, overrideAccess: true })
          }
        } catch (e) { console.error('upsertThread error:', e) }

        send({ type: 'done', total })
      } catch (e) {
        send({ type: 'error', error: String(e) })
      } finally {
        ctrl.close()
      }
    },
  })

  return new Response(stream, { headers: { ...CORS, 'Content-Type': 'application/x-ndjson' } })
}
