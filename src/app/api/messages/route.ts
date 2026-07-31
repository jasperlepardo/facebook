import { ObjectId } from 'mongodb'
import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/db'
import { getSession } from '@/lib/session'
import { getHiddenMessageFilter } from '@/lib/hidden-filter-cache'

// superAdmin comes straight from the JWT claim — no extra DB round trip needed
async function buildFilter(superAdmin: boolean, showHidden: boolean): Promise<Record<string, unknown>> {
  if (showHidden && superAdmin) return {}
  return getHiddenMessageFilter()
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
}

function clean(doc: Record<string, unknown>) {
  const d = { ...doc }
  if (d._id) d._id = String(d._id)
  if (d.blockId) d.blockId = String(d.blockId)
  return d
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS })
}

// POST { blockIds?, messageIds?, showHidden?, thread } — fetch messages by block or by specific IDs
export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    const { blockIds: rawBlockIds, messageIds: rawMsgIds, showHidden, thread } = await req.json()
    const col    = await getCollection(thread ?? 'messages')
    const filter = await buildFilter(!!session?.superAdmin, !!showHidden)

    if (Array.isArray(rawMsgIds) && rawMsgIds.length) {
      const msgIds   = rawMsgIds.map(id => { try { return new ObjectId(id) } catch { return null } }).filter((id): id is ObjectId => id !== null)
      const targeted = await col.find({ ...filter, _id: { $in: msgIds } }, { projection: { blockId: 1 } }).toArray()
      const blockIds = [...new Set(targeted.map(m => m.blockId))]
      const docs     = await col.find({ ...filter, blockId: { $in: blockIds } }).sort({ timestamp_ms: 1 }).toArray()
      return NextResponse.json({ messages: docs.map(clean) }, { headers: CORS })
    }

    if (!Array.isArray(rawBlockIds) || !rawBlockIds.length) return NextResponse.json({ messages: [] }, { headers: CORS })
    const blockIds = rawBlockIds.map(id => { try { return new ObjectId(id) } catch { return id as unknown as ObjectId } })
    const docs     = await col.find({ ...filter, blockId: { $in: blockIds } }).sort({ timestamp_ms: 1 }).toArray()
    return NextResponse.json({ messages: docs.map(clean) }, { headers: CORS })
  } catch (e: unknown) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const idsParam      = searchParams.get('ids')
  const groupIdsParam = searchParams.get('groupIds')
  const off        = parseInt(searchParams.get('offset') ?? '0')
  const limit      = Math.min(parseInt(searchParams.get('limit') ?? '80'), 200)
  const q          = (searchParams.get('search') ?? '').trim()
  const asc        = searchParams.get('asc') === '1'
  const showHidden = searchParams.get('showHidden') === '1'
  const thread     = searchParams.get('thread') ?? 'messages'

  try {
    const session = await getSession()
    const msgs    = await getCollection(thread)
    const filter  = await buildFilter(!!session?.superAdmin, showHidden)

    const tsFrom = searchParams.get('tsFrom')
    const tsTo   = searchParams.get('tsTo')
    if (tsFrom && tsTo) {
      const docs = await msgs.find({ ...filter, timestamp_ms: { $gte: parseInt(tsFrom), $lte: parseInt(tsTo) } }).sort({ timestamp_ms: 1 }).toArray()
      return NextResponse.json({ messages: docs.map(clean) }, { headers: CORS })
    }

    if (groupIdsParam) {
      const rawIds   = groupIdsParam.split(',').filter(Boolean)
      const blockIds = rawIds.map(id => { try { return new ObjectId(id) } catch { return id as unknown as ObjectId } })
      const docs     = await msgs.find({ ...filter, blockId: { $in: blockIds } }).sort({ timestamp_ms: 1 }).toArray()
      return NextResponse.json({ messages: docs.map(clean) }, { headers: CORS })
    }

    if (idsParam) {
      const ids  = idsParam.split(',').filter(Boolean).map(id => { try { return new ObjectId(id) } catch { return null } }).filter((id): id is ObjectId => id !== null)
      const docs = await msgs.find({ ...filter, _id: { $in: ids } }).sort({ timestamp_ms: 1 }).toArray()
      return NextResponse.json({ messages: docs.map(clean) }, { headers: CORS })
    }

    if (q) {
      const filt = { ...filter, $text: { $search: q } }
      // count + data in parallel for search
      const [total, page] = await Promise.all([
        msgs.countDocuments(filt),
        msgs.find(filt, { projection: { score: { $meta: 'textScore' } } })
          .sort({ score: { $meta: 'textScore' }, timestamp_ms: 1 })
          .skip(off).limit(limit).toArray(),
      ])
      return NextResponse.json({ messages: page.map(clean), total, has_more: off + limit < total }, { headers: CORS })
    }

    if (asc) {
      // count + data in parallel — eliminates one sequential round trip
      const [total, page] = await Promise.all([
        msgs.countDocuments(filter),
        msgs.find(filter).sort({ timestamp_ms: 1 }).skip(off).limit(limit).toArray(),
      ])
      return NextResponse.json({ messages: page.map(clean), total, has_more: off + limit < total }, { headers: CORS })
    }

    // Descending (most-recent-first): use desc sort + reverse to avoid needing count before skip
    const [total, page] = await Promise.all([
      msgs.countDocuments(filter),
      msgs.find(filter).sort({ timestamp_ms: -1 }).skip(off).limit(limit).toArray(),
    ])
    return NextResponse.json({ messages: page.reverse().map(clean), total, has_more: off + limit < total }, { headers: CORS })
  } catch (e: unknown) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}
