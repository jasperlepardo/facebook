import { NextRequest, NextResponse } from 'next/server'
import { getCollection, isSafeCollectionName } from '@/lib/db'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'private, no-store',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS })
}

// Types that are a single object on the message (not an array)
const SINGULAR_TYPES: Record<string, { match: Record<string, unknown>; project: Record<string, unknown> }> = {
  stickers: {
    match:   { sticker: { $exists: true } },
    project: { uri: '$sticker.uri', ts: '$timestamp_ms', sender: '$sender_name', msgId: { $toString: '$_id' } },
  },
  links: {
    match:   { 'share.link': { $exists: true } },
    project: { uri: '$share.link', text: '$share.share_text', ts: '$timestamp_ms', sender: '$sender_name', msgId: { $toString: '$_id' } },
  },
  calls: {
    match:   { call_duration: { $exists: true } },
    project: { duration: '$call_duration', missed: '$missed', content: '$content', ts: '$timestamp_ms', sender: '$sender_name', msgId: { $toString: '$_id' } },
  },
}

const ARRAY_FIELD: Record<string, string> = {
  photos: 'photos', videos: 'videos', gifs: 'gifs', files: 'files', audio: 'audio_files',
}

/** Parse optional senderId / tsFrom / tsTo into a Mongo $match fragment. */
function parseExtraMatch(searchParams: URLSearchParams): Record<string, unknown> {
  const senderIds = (searchParams.get('senderId') ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  const extra: Record<string, unknown> = {}
  if (senderIds.length === 1) extra.senderId = senderIds[0]
  else if (senderIds.length > 1) extra.senderId = { $in: senderIds }

  const tsFrom = searchParams.get('tsFrom')
  const tsTo = searchParams.get('tsTo')
  if (tsFrom || tsTo) {
    const range: Record<string, number> = {}
    if (tsFrom) range.$gte = parseInt(tsFrom)
    if (tsTo) range.$lte = parseInt(tsTo)
    extra.timestamp_ms = range
  }
  return extra
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const atype  = searchParams.get('type') ?? 'photos'
  const off    = parseInt(searchParams.get('offset') ?? '0')
  const limit  = Math.min(parseInt(searchParams.get('limit') ?? '60'), 500)
  const thread = searchParams.get('thread') ?? 'messages'
  const extra  = parseExtraMatch(searchParams)

  if (!isSafeCollectionName(thread)) {
    return NextResponse.json({ error: 'Invalid thread' }, { status: 400, headers: CORS })
  }

  try {
    const msgs = await getCollection(thread)

    // ── Singular types (stickers, links, calls) ──────────────────────────────
    if (atype in SINGULAR_TYPES) {
      const { match, project } = SINGULAR_TYPES[atype]
      const filt = { ...match, ...extra }
      const [result] = await msgs.aggregate([
        { $match: filt },
        { $facet: {
          data:  [{ $sort: { timestamp_ms: 1 } }, { $skip: off }, { $limit: limit }, { $project: { _id: 0, ...project } }],
          total: [{ $count: 'n' }],
        }},
      ]).toArray() as any[]
      const total = result.total[0]?.n ?? 0
      return NextResponse.json({ items: result.data, total, has_more: off + limit < total }, { headers: CORS })
    }

    // ── Array types (photos, videos, gifs, files, audio) ─────────────────────
    const field = ARRAY_FIELD[atype] ?? 'photos'
    const filt  = { [field]: { $exists: true, $not: { $size: 0 } }, ...extra }

    // ?offsetOf=TIMESTAMP&uri=URI — photo-level offset for lightbox navigation
    const offsetOf = searchParams.get('offsetOf')
    if (offsetOf) {
      const ts  = parseInt(offsetOf)
      const uri = searchParams.get('uri') ?? ''
      const { timestamp_ms: tsRange, ...filtRest } = filt as Record<string, unknown> & {
        timestamp_ms?: { $gte?: number; $lte?: number }
      }
      const beforeTs: Record<string, number> = { ...(tsRange ?? {}), $lt: ts }
      const [beforeAgg, sameMsg] = await Promise.all([
        msgs.aggregate([
          { $match: { ...filtRest, timestamp_ms: beforeTs } },
          { $unwind: `$${field}` },
          { $count: 'n' },
        ]).toArray(),
        uri ? msgs.findOne({ ...filtRest, timestamp_ms: ts }) : Promise.resolve(null),
      ])
      // If an exact-ts hit falls outside the active date window, treat as missing.
      const inRange = !tsRange
        || ((tsRange.$gte == null || ts >= tsRange.$gte) && (tsRange.$lte == null || ts <= tsRange.$lte))
      const base = (beforeAgg[0] as any)?.n ?? 0
      if (uri && sameMsg && inRange) {
        const arr = (sameMsg[field] as { uri?: string }[]) ?? []
        const idx = arr.findIndex(p => p.uri === uri)
        return NextResponse.json({ offset: base + Math.max(0, idx) }, { headers: CORS })
      }
      return NextResponse.json({ offset: base }, { headers: CORS })
    }

    // Single $facet pipeline: count total unwound items + paginated data in one round trip
    const [result] = await msgs.aggregate([
      { $match: filt },
      { $sort: { timestamp_ms: 1 } },
      { $facet: {
        data:  [{ $unwind: `$${field}` }, { $skip: off }, { $limit: limit },
                { $project: { _id: 0, uri: `$${field}.uri`, ts: '$timestamp_ms', sender: '$sender_name', msgId: { $toString: '$_id' } } }],
        total: [{ $unwind: `$${field}` }, { $count: 'n' }],
      }},
    ]).toArray() as any[]

    const total = result.total[0]?.n ?? 0
    const items = (result.data as any[]).filter(d => d.uri)
    return NextResponse.json({ items, total, has_more: off + limit < total }, { headers: CORS })
  } catch (e: unknown) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}
