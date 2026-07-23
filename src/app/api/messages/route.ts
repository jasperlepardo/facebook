import { ObjectId } from 'mongodb'
import { NextRequest, NextResponse } from 'next/server'
import { getMessages } from '@/lib/db'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const idsParam = searchParams.get('ids')
  const off   = parseInt(searchParams.get('offset') ?? '0')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '80'), 200)
  const q     = (searchParams.get('search') ?? '').trim()
  const asc   = searchParams.get('asc') === '1'

  try {
    const msgs = await getMessages()

    if (idsParam) {
      const ids = idsParam.split(',').filter(Boolean).map(id => { try { return new ObjectId(id) } catch { return null } }).filter(Boolean)
      const docs = await msgs.find({ _id: { $in: ids } }).sort({ timestamp_ms: 1 }).toArray()
      return NextResponse.json({ messages: docs.map(clean) }, { headers: CORS })
    }

    if (q) {
      const filt = { $text: { $search: q } }
      const total = await msgs.countDocuments(filt)
      const page  = await msgs.find(filt, { projection: { score: { $meta: 'textScore' } } })
        .sort({ score: { $meta: 'textScore' }, timestamp_ms: 1 })
        .skip(off).limit(limit).toArray()
      return NextResponse.json({ messages: page.map(clean), total, has_more: off + limit < total }, { headers: CORS })
    } else if (asc) {
      const total = await msgs.estimatedDocumentCount()
      const page  = await msgs.find().sort({ timestamp_ms: 1 }).skip(off).limit(limit).toArray()
      return NextResponse.json({ messages: page.map(clean), total, has_more: off + limit < total }, { headers: CORS })
    } else {
      const total = await msgs.estimatedDocumentCount()
      const skip  = Math.max(0, total - off - limit)
      const page  = await msgs.find().sort({ timestamp_ms: 1 }).skip(skip).limit(limit).toArray()
      return NextResponse.json({ messages: page.map(clean), total, has_more: skip > 0 }, { headers: CORS })
    }
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}
