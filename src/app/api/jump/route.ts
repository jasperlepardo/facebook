import { ObjectId } from 'mongodb'
import { NextRequest, NextResponse } from 'next/server'
import { getCollection, isSafeCollectionName } from '@/lib/db'
import { indexBeforeTimestamp } from '@/lib/dateIndex'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'private, no-store',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const msgId   = searchParams.get('msgId')
  const dateStr = searchParams.get('date') ?? ''
  const thread  = searchParams.get('thread') ?? 'messages'
  if (!isSafeCollectionName(thread)) {
    return NextResponse.json({ error: 'Invalid thread' }, { status: 400, headers: CORS })
  }
  try {
    let targetTs: number
    if (msgId) {
      const msgs = await getCollection(thread)
      const doc = await msgs.findOne({ _id: new ObjectId(msgId) }, { projection: { timestamp_ms: 1 } })
      if (!doc) return NextResponse.json({ index: null }, { headers: CORS })
      targetTs = doc.timestamp_ms as number
    } else {
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) throw new Error('Invalid date')
      targetTs = date.getTime()
    }
    const idx = await indexBeforeTimestamp(thread, targetTs)
    return NextResponse.json({ index: idx }, { headers: CORS })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 400, headers: CORS })
  }
}
