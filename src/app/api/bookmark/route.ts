import { NextRequest, NextResponse } from 'next/server'
import { getSettings } from '@/lib/db'

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS })
}

export async function GET(req: NextRequest) {
  try {
    const params   = new URL(req.url).searchParams
    const deviceId = params.get('deviceId') || 'default'
    const ns       = params.get('ns') || ''
    const col = await getSettings()
    const doc = await col.findOne({ key: `bookmark-${ns ? ns + '-' : ''}${deviceId}` })
    return NextResponse.json({ msgId: doc?.msgId ?? null, offset: doc?.offset ?? 0 }, { headers: CORS })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { msgId, offset = 0, deviceId = 'default', ns = '' } = await req.json()
    if (!msgId) return NextResponse.json({ error: 'missing msgId' }, { status: 400, headers: CORS })
    const col = await getSettings()
    const key = `bookmark-${ns ? ns + '-' : ''}${deviceId}`
    await col.updateOne({ key }, { $set: { key, msgId, offset } }, { upsert: true })
    return NextResponse.json({ ok: true }, { headers: CORS })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}
