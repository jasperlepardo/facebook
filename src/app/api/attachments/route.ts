import { NextRequest, NextResponse } from 'next/server'
import { getMessages } from '@/lib/db'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const atype = searchParams.get('type') ?? 'photos'
  const off   = parseInt(searchParams.get('offset') ?? '0')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '60'), 200)
  const field = ({ photos: 'photos', videos: 'videos', gifs: 'gifs', files: 'files', audio: 'audio_files' } as Record<string, string>)[atype] ?? 'photos'

  try {
    const msgs = await getMessages()
    const filt = { [field]: { $exists: true, $not: { $size: 0 } } }

    // ?offsetOf=TIMESTAMP&uri=URI — return the photo-level offset of a specific photo
    const offsetOf = searchParams.get('offsetOf')
    if (offsetOf) {
      const ts  = parseInt(offsetOf)
      const uri = searchParams.get('uri') ?? ''

      // Count individual photos in messages strictly before this timestamp
      const beforeAgg = await msgs.aggregate([
        { $match: { ...filt, timestamp_ms: { $lt: ts } } },
        { $unwind: `$${field}` },
        { $count: 'n' },
      ]).toArray()
      const base = (beforeAgg[0] as any)?.n ?? 0

      // Find photo's position within the same-timestamp message
      if (uri) {
        const sameMsg = await msgs.findOne({ timestamp_ms: ts, ...filt })
        if (sameMsg) {
          const arr = (sameMsg[field] as { uri?: string }[]) ?? []
          const idx = arr.findIndex(p => p.uri === uri)
          return NextResponse.json({ offset: base + Math.max(0, idx) }, { headers: CORS })
        }
      }
      return NextResponse.json({ offset: base }, { headers: CORS })
    }

    // Photo-level total
    const totalAgg = await msgs.aggregate([
      { $match: filt },
      { $unwind: `$${field}` },
      { $count: 'total' },
    ]).toArray()
    const total = (totalAgg[0] as any)?.total ?? 0

    // Photo-level paginated list
    const docs = await msgs.aggregate([
      { $match: filt },
      { $sort: { timestamp_ms: 1 } },
      { $unwind: `$${field}` },
      { $skip: off },
      { $limit: limit },
      { $project: { uri: `$${field}.uri`, ts: '$timestamp_ms', sender: '$sender_name', msgId: { $toString: '$_id' } } },
    ]).toArray()

    const items = docs.map((d: any) => ({ uri: d.uri, ts: d.ts, sender: d.sender ?? '', msgId: d.msgId }))
    return NextResponse.json({ items, total, has_more: off + limit < total }, { headers: CORS })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}
