import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { getMessages } from '@/lib/db'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS })
}

// GET ?hashtagId=xxx  → blockIds for that hashtag
// GET ?blockId=xxx    → hashtagIds that contain that block
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const hashtagId = searchParams.get('hashtagId')
  const blockId   = searchParams.get('blockId')

  try {
    const payload = await getPayload({ config })

    if (hashtagId) {
      const result = await payload.find({
        collection: 'hashtag-groups',
        where: { hashtagId: { equals: hashtagId } },
        pagination: false,
        depth: 0,
        overrideAccess: true,
      })
      return NextResponse.json({
        groups: result.docs.map(d => ({ id: d.id, hashtagId: d.hashtagId, blockId: d.blockId, firstMsgTs: d.firstMsgTs })),
      }, { headers: CORS })
    }

    if (blockId) {
      const result = await payload.find({
        collection: 'hashtag-groups',
        where: { blockId: { equals: blockId } },
        depth: 0,
        overrideAccess: true,
      })
      return NextResponse.json({
        groups: result.docs.map(d => ({ id: d.id, hashtagId: d.hashtagId, blockId: d.blockId })),
      }, { headers: CORS })
    }

    return NextResponse.json({ error: 'hashtagId or blockId required' }, { status: 400, headers: CORS })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}

// POST { hashtagId, blockId } — idempotent tag
export async function POST(req: NextRequest) {
  try {
    const { hashtagId, blockId } = await req.json()
    if (!hashtagId || !blockId) return NextResponse.json({ error: 'hashtagId and blockId required' }, { status: 400, headers: CORS })

    const payload = await getPayload({ config })

    const existing = await payload.find({
      collection: 'hashtag-groups',
      where: { hashtagId: { equals: hashtagId }, blockId: { equals: blockId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.totalDocs > 0) return NextResponse.json({ ok: true }, { headers: CORS })

    // messages is not a Payload collection — raw MongoDB for firstMsgTs lookup only
    const msgs = await getMessages()
    const msg = await msgs.findOne({ blockId }, { sort: { timestamp_ms: 1 } } as any)
    const firstMsgTs: number | undefined = (msg as any)?.timestamp_ms

    // afterChange hook on HashtagGroups will resync groupCount + firstMsgTs on Hashtag
    await payload.create({
      collection: 'hashtag-groups',
      data: { hashtagId, blockId, ...(firstMsgTs !== undefined ? { firstMsgTs } : {}) },
      overrideAccess: true,
    })

    return NextResponse.json({ ok: true }, { headers: CORS })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}

// DELETE { hashtagId, blockId } — untag
export async function DELETE(req: NextRequest) {
  try {
    const { hashtagId, blockId } = await req.json()
    if (!hashtagId || !blockId) return NextResponse.json({ error: 'hashtagId and blockId required' }, { status: 400, headers: CORS })

    const payload = await getPayload({ config })

    const existing = await payload.find({
      collection: 'hashtag-groups',
      where: { hashtagId: { equals: hashtagId }, blockId: { equals: blockId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.totalDocs === 0) return NextResponse.json({ ok: true }, { headers: CORS })

    // afterDelete hook on HashtagGroups will resync groupCount + firstMsgTs on Hashtag
    await payload.delete({
      collection: 'hashtag-groups',
      id: existing.docs[0].id,
      overrideAccess: true,
    })

    return NextResponse.json({ ok: true }, { headers: CORS })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}
