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
    const msgs  = await getMessages()
    const filt  = { [field]: { $exists: true, $not: { $size: 0 } } }

    // ?offsetOf=TIMESTAMP — return the document offset of the first photo at/after that timestamp
    const offsetOf = searchParams.get('offsetOf')
    if (offsetOf) {
      const ts  = parseInt(offsetOf)
      const idx = await msgs.countDocuments({ ...filt, timestamp_ms: { $lt: ts } })
      return NextResponse.json({ offset: idx }, { headers: CORS })
    }

    const total = await msgs.countDocuments(filt)
    const docs  = await msgs.find(filt, { projection: { [field]: 1, timestamp_ms: 1, sender_name: 1 } })
      .sort({ timestamp_ms: 1 }).skip(off).limit(limit).toArray()
    const items: { uri: string; ts: number; sender: string; msgId: string }[] = []
    for (const m of docs) {
      for (const att of (m[field] as { uri?: string }[] ?? [])) {
        if (att.uri) items.push({ uri: att.uri, ts: m.timestamp_ms as number, sender: m.sender_name as string ?? '', msgId: String(m._id) })
      }
    }
    return NextResponse.json({ items, total, has_more: off + limit < total }, { headers: CORS })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}
