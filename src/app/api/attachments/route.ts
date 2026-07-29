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

// Types that are a single object on the message (not an array)
const SINGULAR_TYPES: Record<string, { match: Record<string, unknown>; project: Record<string, unknown> }> = {
  stickers: {
    match: { sticker: { $exists: true } },
    project: { uri: '$sticker.uri', ts: '$timestamp_ms', sender: '$sender_name', msgId: { $toString: '$_id' } },
  },
  links: {
    match: { 'share.link': { $exists: true } },
    project: { uri: '$share.link', text: '$share.share_text', ts: '$timestamp_ms', sender: '$sender_name', msgId: { $toString: '$_id' } },
  },
  calls: {
    match: { call_duration: { $exists: true } },
    project: { duration: '$call_duration', missed: '$missed', content: '$content', ts: '$timestamp_ms', sender: '$sender_name', msgId: { $toString: '$_id' } },
  },
}

const ARRAY_FIELD: Record<string, string> = {
  photos: 'photos', videos: 'videos', gifs: 'gifs', files: 'files', audio: 'audio_files',
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const atype = searchParams.get('type') ?? 'photos'
  const off   = parseInt(searchParams.get('offset') ?? '0')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '60'), 500)

  try {
    const msgs = await getMessages()

    // ── Singular types (stickers, links, calls) ──────────────────────────────
    if (atype in SINGULAR_TYPES) {
      const { match, project } = SINGULAR_TYPES[atype]
      const total = await msgs.countDocuments(match)
      const docs  = await msgs.aggregate([
        { $match: match },
        { $sort: { timestamp_ms: 1 } },
        { $skip: off },
        { $limit: limit },
        { $project: { _id: 0, ...project } },
      ]).toArray()
      return NextResponse.json({ items: docs, total, has_more: off + limit < total }, { headers: CORS })
    }

    // ── Array types (photos, videos, gifs, files, audio) ─────────────────────
    const field = ARRAY_FIELD[atype] ?? 'photos'
    const filt  = { [field]: { $exists: true, $not: { $size: 0 } } }

    // ?offsetOf=TIMESTAMP&uri=URI — photo-level offset for lightbox
    const offsetOf = searchParams.get('offsetOf')
    if (offsetOf) {
      const ts  = parseInt(offsetOf)
      const uri = searchParams.get('uri') ?? ''
      const beforeAgg = await msgs.aggregate([
        { $match: { ...filt, timestamp_ms: { $lt: ts } } },
        { $unwind: `$${field}` },
        { $count: 'n' },
      ]).toArray()
      const base = (beforeAgg[0] as any)?.n ?? 0
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

    const totalAgg = await msgs.aggregate([
      { $match: filt },
      { $unwind: `$${field}` },
      { $count: 'total' },
    ]).toArray()
    const total = (totalAgg[0] as any)?.total ?? 0

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
