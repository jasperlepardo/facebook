import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/auth'
import { recomputeBlockIds } from '@/lib/blockIds'
import { upsertThread } from '@/lib/threadUtils'
import { invalidateThreadMessageCount } from '@/lib/threadCount'
import { invalidateDateIndex } from '@/lib/dateIndex'

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }

export const maxDuration = 300
export const dynamic     = 'force-dynamic'

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS })
}

export async function POST(req: NextRequest) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status, headers: CORS })

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
        await upsertThread({ collectionName, threadName, participants: participants ?? [], facebookThreadId, initials, color, total })
        invalidateThreadMessageCount(collectionName)
        await invalidateDateIndex(collectionName)

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
