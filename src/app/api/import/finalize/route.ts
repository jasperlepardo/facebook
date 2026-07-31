import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/db'
import { getPayloadClient } from '@/lib/payload-access'
import { getSession } from '@/lib/session'
import { recomputeBlockIds } from '@/lib/blockIds'

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }

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

  const enc = new TextEncoder()

  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (data: object) => ctrl.enqueue(enc.encode(JSON.stringify(data) + '\n'))

      try {
        // ── Recompute blockIds ──────────────────────────────────────────────────
        await recomputeBlockIds(collectionName, (current, total) => {
          send({ type: 'blockids', current, total })
        })

        // ── Upsert thread ───────────────────────────────────────────────────────
        const total = await (await getCollection(collectionName)).countDocuments()
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
