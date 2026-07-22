process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
import { MongoClient, MongoClientOptions } from 'mongodb'
import { NextRequest, NextResponse } from 'next/server'

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' }

let client: MongoClient | null = null
async function getMsgs() {
  if (!client) {
    client = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 10000 } as MongoClientOptions)
    await client.connect()
  }
  return client.db('ciara-notes').collection('messages')
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const atype = searchParams.get('type') ?? 'photos'
  const off   = parseInt(searchParams.get('offset') ?? '0')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '60'), 200)
  const field = ({ photos: 'photos', videos: 'videos', files: 'files', audio: 'audio_files' } as Record<string, string>)[atype] ?? 'photos'

  try {
    const msgs  = await getMsgs()
    const filt  = { [field]: { $exists: true, $not: { $size: 0 } } }
    const total = await msgs.countDocuments(filt)
    const docs  = await msgs.find(filt, { projection: { [field]: 1, timestamp_ms: 1, sender_name: 1 } })
      .sort({ timestamp_ms: 1 }).skip(off).limit(limit).toArray()
    const items: { uri: string; ts: number; sender: string }[] = []
    for (const m of docs) {
      for (const att of (m[field] as { uri?: string }[] ?? [])) {
        if (att.uri) items.push({ uri: att.uri, ts: m.timestamp_ms as number, sender: m.sender_name as string ?? '' })
      }
    }
    return NextResponse.json({ items, total, has_more: off + limit < total }, { headers: CORS })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}
