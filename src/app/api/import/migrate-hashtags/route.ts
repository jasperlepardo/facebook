import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getCollection } from '@/lib/db'
import { getPayloadClient } from '@/lib/payload-access'
import { getSession } from '@/lib/session'

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS' }

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS })
}

// GET ?collection=thread_5b11cb75
// Returns all hashtag-groups with the messages in each block, for review before remapping messageId.
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS })

  const { searchParams } = new URL(req.url)
  const collection = searchParams.get('collection')
  if (!collection) return NextResponse.json({ error: 'collection required' }, { status: 400, headers: CORS })

  try {
    const payload = await getPayloadClient()
    const col     = await getCollection(collection)
    const hgModel = (payload.db as any).collections['hashtag-groups']

    const hgDocs = await hgModel.find({}).lean() as { _id: ObjectId; hashtagId: string; blockId: string; messageId?: string; firstMsgTs?: number }[]

    const uniqueBlockIds = [...new Set(hgDocs.map(h => h.blockId))]
    const allMsgs = await col.find(
      { blockId: { $in: uniqueBlockIds.map(id => new ObjectId(id)) } },
      { projection: { _id: 1, blockId: 1, timestamp_ms: 1, sender_name: 1, content: 1 } },
    ).sort({ timestamp_ms: 1 }).toArray()

    // Group messages by blockId
    const msgsByBlock = new Map<string, { id: string; ts: number; sender: string; preview: string }[]>()
    for (const m of allMsgs) {
      const bid = m.blockId.toHexString()
      if (!msgsByBlock.has(bid)) msgsByBlock.set(bid, [])
      msgsByBlock.get(bid)!.push({
        id:      m._id.toHexString(),
        ts:      Number(m.timestamp_ms),
        sender:  m.sender_name ?? '',
        preview: (m.content ?? '(media)').slice(0, 80),
      })
    }

    // Fetch hashtag names
    const uniqueHashtagIds = [...new Set(hgDocs.map(h => h.hashtagId))]
    const hashtags = await payload.find({
      collection: 'hashtags',
      where: { id: { in: uniqueHashtagIds } },
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })
    const htNames = new Map(hashtags.docs.map(h => [h.id, h.name as string]))

    const groups = hgDocs.map(hg => ({
      id:        hg._id.toHexString(),
      hashtagId: hg.hashtagId,
      hashtag:   htNames.get(hg.hashtagId) ?? hg.hashtagId,
      blockId:   hg.blockId,
      messageId: hg.messageId ?? null,
      messages:  msgsByBlock.get(hg.blockId) ?? [],
    }))

    return NextResponse.json({ groups }, { headers: CORS })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}

// POST { fromCollection: 'messages', toCollection: 'thread_5b11cb75' }
// Remaps blockIds from old collection → new, and sets messageId = blockId (first message in block).
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS })

  const { fromCollection, toCollection } = await req.json()
  if (!fromCollection || !toCollection)
    return NextResponse.json({ error: 'fromCollection and toCollection required' }, { status: 400, headers: CORS })

  try {
    const payload  = await getPayloadClient()
    const fromCol  = await getCollection(fromCollection)
    const toCol    = await getCollection(toCollection)
    const hgModel  = (payload.db as any).collections['hashtag-groups']

    const hgDocs = await hgModel.find({}).lean() as { _id: ObjectId; hashtagId: string; blockId: string }[]

    const uniqueOldIds = [...new Set(hgDocs.map(h => h.blockId))]
    const oldMsgs = await fromCol.find(
      { _id: { $in: uniqueOldIds.map(id => new ObjectId(id)) } },
      { projection: { _id: 1, timestamp_ms: 1 } },
    ).toArray()

    const oldIdToTs = new Map<string, number>()
    for (const m of oldMsgs) oldIdToTs.set(m._id.toHexString(), Number(m.timestamp_ms))

    const timestamps = [...new Set([...oldIdToTs.values()])]
    const newMsgs = await toCol.find(
      { timestamp_ms: { $in: timestamps } },
      { projection: { _id: 1, blockId: 1, timestamp_ms: 1 } },
    ).toArray()

    const tsToNewBlockId = new Map<number, string>()
    for (const m of newMsgs) {
      const ts       = Number(m.timestamp_ms)
      const isAnchor = m._id.equals(m.blockId)
      if (!tsToNewBlockId.has(ts) || isAnchor) tsToNewBlockId.set(ts, m.blockId.toHexString())
    }

    const now = new Date()
    const affectedHashtagIds = new Set<string>()
    let migrated = 0, skipped = 0, failed = 0
    const failedBlockIds: string[] = []

    const bulkOps: object[] = []
    for (const hg of hgDocs) {
      const ts         = oldIdToTs.get(hg.blockId)
      const newBlockId = ts != null ? tsToNewBlockId.get(ts) : undefined
      if (!newBlockId) { failed++; failedBlockIds.push(hg.blockId); continue }
      if (newBlockId === hg.blockId) { skipped++; continue }
      // messageId defaults to the block anchor (first message = blockId)
      bulkOps.push({ updateOne: {
        filter: { _id: hg._id },
        update: { $set: { blockId: newBlockId, messageId: newBlockId, updatedAt: now } },
      }})
      affectedHashtagIds.add(hg.hashtagId)
      migrated++
    }

    if (bulkOps.length > 0) await hgModel.bulkWrite(bulkOps, { ordered: false })

    for (const hashtagId of affectedHashtagIds) {
      const groups = await hgModel.find({ hashtagId }).sort({ firstMsgTs: 1 }).lean() as { firstMsgTs?: number }[]
      await payload.update({
        collection: 'hashtags', id: hashtagId,
        data: { groupCount: groups.length, ...(groups[0]?.firstMsgTs != null ? { firstMsgTs: groups[0].firstMsgTs } : {}) },
        overrideAccess: true,
      })
    }

    return NextResponse.json({ migrated, skipped, failed, failedBlockIds }, { headers: CORS })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}

// PATCH { id: '<hashtag-group-id>', messageId: '<message-id>' }
// Update the messageId for a specific hashtag-group.
export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS })

  const { id, messageId } = await req.json()
  if (!id || !messageId) return NextResponse.json({ error: 'id and messageId required' }, { status: 400, headers: CORS })

  try {
    const payload = await getPayloadClient()
    await payload.update({
      collection: 'hashtag-groups',
      id,
      data: { messageId },
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true }, { headers: CORS })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}
