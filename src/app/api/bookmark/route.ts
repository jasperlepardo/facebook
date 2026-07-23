import { MongoClient, MongoClientOptions } from 'mongodb'
import { NextRequest, NextResponse } from 'next/server'

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }

let client: MongoClient | null = null
async function getSettings() {
  if (!client) {
    client = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 10000 } as MongoClientOptions)
    await client.connect()
  }
  return client.db('ciara-notes').collection('settings')
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS })
}

export async function GET(req: NextRequest) {
  try {
    const deviceId = new URL(req.url).searchParams.get('deviceId') || 'default'
    const col = await getSettings()
    const doc = await col.findOne({ key: `bookmark-${deviceId}` })
    return NextResponse.json({ msgId: doc?.msgId ?? null, offset: doc?.offset ?? 0 }, { headers: CORS })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { msgId, offset = 0, deviceId = 'default' } = await req.json()
    if (!msgId) return NextResponse.json({ error: 'missing msgId' }, { status: 400, headers: CORS })
    const col = await getSettings()
    const key = `bookmark-${deviceId}`
    await col.updateOne({ key }, { $set: { key, msgId, offset } }, { upsert: true })
    return NextResponse.json({ ok: true }, { headers: CORS })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}
