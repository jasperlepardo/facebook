import config from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { getPayload } from 'payload'
import { getCollection, getHashtagGroups, isSafeCollectionName } from '@/lib/db'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS })
}

// GET ?hashtagId=xxx&thread=xxx     → groups for that hashtag in this thread
// GET ?messageId=xxx&thread=xxx     → hashtagIds for that message in this thread
// GET ?messageIds=id1,id2&thread=xx → union of hashtagIds across messages in this thread
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const hashtagId  = searchParams.get('hashtagId')
  const messageId  = searchParams.get('messageId')
  const messageIds = searchParams.get('messageIds')
  const thread     = searchParams.get('thread') // null means no thread filter

  try {
    if (messageIds) {
      const ids = messageIds.split(',').filter(Boolean)
      // Direct Mongo — avoid Payload init/find latency for this hot open path.
      const col = await getHashtagGroups()
      const filter: Record<string, unknown> = { messageId: { $in: ids } }
      if (thread) filter.thread = thread
      const docs = await col.find(filter, { projection: { hashtagId: 1 } }).toArray()
      const hashtagIds = [...new Set(docs.map(d => d.hashtagId).filter(Boolean))]
      return NextResponse.json({ hashtagIds }, { headers: CORS })
    }

    const payload = await getPayload({ config })

    if (hashtagId) {
      // thread filter is optional — omit to return groups across all threads
      const where = { hashtagId: { equals: hashtagId }, ...(thread ? { thread: { equals: thread } } : {}) }
      const result = await payload.find({
        collection: 'hashtag-groups',
        where,
        pagination: false,
        depth: 0,
        overrideAccess: true,
      })
      return NextResponse.json({
        groups: result.docs.map(d => ({ id: d.id, hashtagId: d.hashtagId, messageId: d.messageId, thread: d.thread, firstMsgTs: d.firstMsgTs })),
      }, { headers: CORS })
    }

    if (messageId) {
      const result = await payload.find({
        collection: 'hashtag-groups',
        where: { messageId: { equals: messageId }, thread: { equals: thread } },
        depth: 0,
        overrideAccess: true,
      })
      return NextResponse.json({
        groups: result.docs.map(d => ({ id: d.id, hashtagId: d.hashtagId, messageId: d.messageId, thread: d.thread })),
      }, { headers: CORS })
    }

    return NextResponse.json({ error: 'hashtagId, messageId, or messageIds required' }, { status: 400, headers: CORS })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}

// POST { hashtagId, messageIds: string[], thread: string } — idempotent batch tag
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const hashtagId: string  = body.hashtagId
    const thread: string     = body.thread ?? 'messages'
    const messageIds: string[] = body.messageIds ?? (body.messageId ? [body.messageId] : [])
    if (!hashtagId || !messageIds.length)
      return NextResponse.json({ error: 'hashtagId and messageIds required' }, { status: 400, headers: CORS })
    if (!isSafeCollectionName(thread))
      return NextResponse.json({ error: 'Invalid thread' }, { status: 400, headers: CORS })

    const payload = await getPayload({ config })
    const model   = (payload.db as any).collections['hashtag-groups']

    const existing = await model.find({ hashtagId, thread, messageId: { $in: messageIds } }).lean()
    const existingSet = new Set((existing as { messageId: string }[]).map(d => d.messageId))
    const newMessageIds = messageIds.filter((mid: string) => !existingSet.has(mid))

    if (newMessageIds.length > 0) {
      const msgs = await getCollection(thread)
      const msgDocs = await msgs.find(
        { _id: { $in: newMessageIds.map((id: string) => new ObjectId(id)) } },
        { projection: { _id: 1, timestamp_ms: 1 } }
      ).toArray()
      const tsMap = new Map<string, number>()
      for (const m of msgDocs) tsMap.set(m._id.toHexString(), m.timestamp_ms as number)

      const now = new Date()
      await model.insertMany(newMessageIds.map((messageId: string) => ({
        hashtagId,
        messageId,
        thread,
        ...(tsMap.has(messageId) ? { firstMsgTs: tsMap.get(messageId) } : {}),
        createdAt: now,
        updatedAt: now,
        __v: 0,
      })))

      const allGroups = await model.find({ hashtagId, thread }).sort({ firstMsgTs: 1 }).lean() as { firstMsgTs?: number }[]
      await payload.update({
        collection: 'hashtags',
        id: hashtagId,
        data: {
          groupCount: allGroups.length,
          ...(allGroups[0]?.firstMsgTs != null ? { firstMsgTs: allGroups[0].firstMsgTs } : {}),
        },
        overrideAccess: true,
      })
    }

    return NextResponse.json({ ok: true, created: newMessageIds.length }, { headers: CORS })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}

// DELETE { hashtagId, messageId, thread } — untag
export async function DELETE(req: NextRequest) {
  try {
    const { hashtagId, messageId, thread = 'messages' } = await req.json()
    if (!hashtagId || !messageId)
      return NextResponse.json({ error: 'hashtagId and messageId required' }, { status: 400, headers: CORS })

    const payload = await getPayload({ config })

    const existing = await payload.find({
      collection: 'hashtag-groups',
      where: { hashtagId: { equals: hashtagId }, messageId: { equals: messageId }, thread: { equals: thread } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.totalDocs === 0) return NextResponse.json({ ok: true, created: 0 }, { headers: CORS })

    await payload.delete({
      collection: 'hashtag-groups',
      id: existing.docs[0].id,
      overrideAccess: true,
    })

    return NextResponse.json({ ok: true }, { headers: CORS })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}
