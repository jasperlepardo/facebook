import { ObjectId } from 'mongodb'
import { NextRequest, NextResponse } from 'next/server'
import { getMessages, getHiddenItems } from '@/lib/db'
import { getSession } from '@/lib/session'
import { getPayloadClient } from '@/lib/payload-access'

async function isSuperAdmin(): Promise<boolean> {
  try {
    const session = await getSession()
    if (!session) return false
    const payload = await getPayloadClient()
    const user = await payload.findByID({ collection: 'users', id: session.userId })
    return !!(user as any)?.superAdmin
  } catch { return false }
}

let hiddenFilterCache: Record<string, unknown> | null = null
let hiddenFilterCacheAt = 0
const HIDDEN_CACHE_TTL = 60_000

async function buildFilter(showHidden: boolean): Promise<Record<string, unknown>> {
  if (showHidden && await isSuperAdmin()) return {}
  const now = Date.now()
  if (hiddenFilterCache !== null && now - hiddenFilterCacheAt < HIDDEN_CACHE_TTL) {
    return hiddenFilterCache
  }
  const col = await getHiddenItems()
  const hidden = await col.find({ type: 'message' }).project({ value: 1 }).toArray()
  const ids = hidden.map(h => { try { return new ObjectId(h.value) } catch { return null } }).filter(Boolean)
  hiddenFilterCache = ids.length ? { _id: { $nin: ids } } : {}
  hiddenFilterCacheAt = now
  return hiddenFilterCache
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

// POST { blockIds: string[] } — fetch all messages for a set of blocks (no URL length limit)
export async function POST(req: NextRequest) {
  try {
    const { blockIds: rawIds, showHidden } = await req.json()
    if (!Array.isArray(rawIds) || !rawIds.length) return NextResponse.json({ messages: [] }, { headers: CORS })
    const msgs = await getMessages()
    // blockId in MongoDB is stored as ObjectId (same type as _id)
    const blockIds = rawIds.map(id => { try { return new ObjectId(id) } catch { return id as unknown as ObjectId } })
    const filter = await buildFilter(!!showHidden)
    const docs = await msgs.find({ ...filter, blockId: { $in: blockIds } }).sort({ timestamp_ms: 1 }).toArray()
    return NextResponse.json({ messages: docs.map(clean) }, { headers: CORS })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}

const GROUP_GAP = 5 * 60_000

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const idsParam      = searchParams.get('ids')
  const groupIdsParam = searchParams.get('groupIds')
  const off   = parseInt(searchParams.get('offset') ?? '0')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '80'), 200)
  const q     = (searchParams.get('search') ?? '').trim()
  const asc   = searchParams.get('asc') === '1'
  const showHidden = searchParams.get('showHidden') === '1'

  try {
    const msgs = await getMessages()
    const filter = await buildFilter(showHidden)

    const tsFrom = searchParams.get('tsFrom')
    const tsTo   = searchParams.get('tsTo')
    if (tsFrom && tsTo) {
      const docs = await msgs.find({ ...filter, timestamp_ms: { $gte: parseInt(tsFrom), $lte: parseInt(tsTo) } }).sort({ timestamp_ms: 1 }).toArray()
      return NextResponse.json({ messages: docs.map(clean) }, { headers: CORS })
    }

    if (groupIdsParam) {
      const rawIds = groupIdsParam.split(',').filter(Boolean)
      const blockIds = rawIds.map(id => { try { return new ObjectId(id) } catch { return id as unknown as ObjectId } })
      const docs = await msgs.find({ ...filter, blockId: { $in: blockIds } }).sort({ timestamp_ms: 1 }).toArray()
      return NextResponse.json({ messages: docs.map(clean) }, { headers: CORS })
    }

    if (idsParam) {
      const ids = idsParam.split(',').filter(Boolean).map(id => { try { return new ObjectId(id) } catch { return null } }).filter(Boolean)
      const docs = await msgs.find({ ...filter, _id: { $in: ids } }).sort({ timestamp_ms: 1 }).toArray()
      return NextResponse.json({ messages: docs.map(clean) }, { headers: CORS })
    }

    if (q) {
      const filt = { ...filter, $text: { $search: q } }
      const total = await msgs.countDocuments(filt)
      const page  = await msgs.find(filt, { projection: { score: { $meta: 'textScore' } } })
        .sort({ score: { $meta: 'textScore' }, timestamp_ms: 1 })
        .skip(off).limit(limit).toArray()
      return NextResponse.json({ messages: page.map(clean), total, has_more: off + limit < total }, { headers: CORS })
    } else if (asc) {
      const total = await msgs.countDocuments(filter)
      const page  = await msgs.find(filter).sort({ timestamp_ms: 1 }).skip(off).limit(limit).toArray()
      return NextResponse.json({ messages: page.map(clean), total, has_more: off + limit < total }, { headers: CORS })
    } else {
      const total = await msgs.countDocuments(filter)
      const skip  = Math.max(0, total - off - limit)
      const page  = await msgs.find(filter).sort({ timestamp_ms: 1 }).skip(skip).limit(limit).toArray()
      return NextResponse.json({ messages: page.map(clean), total, has_more: skip > 0 }, { headers: CORS })
    }
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}
