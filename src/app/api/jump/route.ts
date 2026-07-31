import { ObjectId } from 'mongodb'
import { NextRequest, NextResponse } from 'next/server'
import { getCollection } from '@/lib/db'

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
  const msgId   = searchParams.get('msgId')
  const dateStr = searchParams.get('date') ?? ''
  const thread  = searchParams.get('thread') ?? 'messages'
  try {
    const msgs = await getCollection(thread)
    let targetTs: number
    if (msgId) {
      const doc = await msgs.findOne({ _id: new ObjectId(msgId) }, { projection: { timestamp_ms: 1 } })
      if (!doc) return NextResponse.json({ index: null }, { headers: CORS })
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
