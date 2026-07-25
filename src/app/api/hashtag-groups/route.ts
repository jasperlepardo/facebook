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

// GET ?hashtagId=xxx           → groups for that hashtag
// GET ?blockId=xxx             → hashtagIds for that block
// GET ?blockIds=id1,id2,...    → union of hashtagIds across all blocks (batch pre-check)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const hashtagId  = searchParams.get('hashtagId')
  const blockId    = searchParams.get('blockId')
  const blockIds   = searchParams.get('blockIds')

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

    if (blockIds) {
      const ids = blockIds.split(',').filter(Boolean)
      const result = await payload.find({
        collection: 'hashtag-groups',
        where: { blockId: { in: ids } },
        pagination: false,
        depth: 0,
        overrideAccess: true,
      })
      const hashtagIds = [...new Set(result.docs.map(d => d.hashtagId as string))]
      return NextResponse.json({ hashtagIds }, { headers: CORS })
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

// POST { hashtagId, blockIds: string[] } — idempotent batch tag
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const hashtagId: string = body.hashtagId
    // Support both single blockId and batch blockIds
    const blockIds: string[] = body.blockIds ?? (body.blockId ? [body.blockId] : [])
    if (!hashtagId || !blockIds.length) return NextResponse.json({ error: 'hashtagId and blockIds required' }, { status: 400, headers: CORS })

    const payload = await getPayload({ config })
    const model = (payload.db as any).collections['hashtag-groups']

    // Find which blockIds already exist in one query
    const existing = await model.find({ hashtagId, blockId: { $in: blockIds } }).lean()
    const existingSet = new Set((existing as { blockId: string }[]).map(d => d.blockId))
    const newBlockIds = blockIds.filter(bid => !existingSet.has(bid))

    if (newBlockIds.length > 0) {
      // Fetch firstMsgTs for all new blocks in one query
      const msgs = await getMessages()
      const msgDocs = await msgs.find(
        { blockId: { $in: newBlockIds } },
        { projection: { blockId: 1, timestamp_ms: 1 } }
      ).sort({ timestamp_ms: 1 }).toArray()
      const tsMap = new Map<string, number>()
      for (const m of msgDocs) {
        const bid = String(m.blockId)
        if (!tsMap.has(bid)) tsMap.set(bid, m.timestamp_ms as number)
      }

      // Bulk insert, bypassing per-doc hooks to avoid concurrent resyncs
      const now = new Date()
      await model.insertMany(newBlockIds.map(blockId => ({
        hashtagId,
        blockId,
        ...(tsMap.has(blockId) ? { firstMsgTs: tsMap.get(blockId) } : {}),
        createdAt: now,
        updatedAt: now,
        __v: 0,
      })))

      // Single resync after all inserts
      const allGroups = await model.find({ hashtagId }).sort({ firstMsgTs: 1 }).lean() as { firstMsgTs?: number }[]
      const groupCount = allGroups.length
      const firstMsgTs = allGroups[0]?.firstMsgTs
      await payload.update({
        collection: 'hashtags',
        id: hashtagId,
        data: { groupCount, ...(firstMsgTs != null ? { firstMsgTs } : {}) },
        overrideAccess: true,
      })
    }

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
