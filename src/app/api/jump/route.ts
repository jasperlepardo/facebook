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
  const dateStr = new URL(req.url).searchParams.get('date') ?? ''
  try {
    const fmt = dateStr.includes('T') ? /(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/ : /(\d{4}-\d{2}-\d{2})/
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) throw new Error('Invalid date')
    const targetTs = date.getTime()
    const msgs = await getMsgs()
    const idx  = await msgs.countDocuments({ timestamp_ms: { $lt: targetTs } })
    return NextResponse.json({ index: idx }, { headers: CORS })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 400, headers: CORS })
  }
}
