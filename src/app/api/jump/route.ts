import { MongoClient, MongoClientOptions, ObjectId } from 'mongodb'
import { NextRequest, NextResponse } from 'next/server'

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' }

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
  const msgId   = searchParams.get('msgId')
  const dateStr = searchParams.get('date') ?? ''
  try {
    const msgs = await getMsgs()
    let targetTs: number
    if (msgId) {
      const doc = await msgs.findOne({ _id: new ObjectId(msgId) }, { projection: { timestamp_ms: 1 } })
      if (!doc) return NextResponse.json({ error: 'not found' }, { status: 404, headers: CORS })
      targetTs = doc.timestamp_ms as number
    } else {
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) throw new Error('Invalid date')
      targetTs = date.getTime()
    }
    const idx = await msgs.countDocuments({ timestamp_ms: { $lt: targetTs } })
    return NextResponse.json({ index: idx }, { headers: CORS })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 400, headers: CORS })
  }
}
