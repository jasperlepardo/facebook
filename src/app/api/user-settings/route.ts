import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getUserSettings } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({})
  const col = await getUserSettings()
  const doc = await col.findOne({ userId: session.userId }, { projection: { _id: 0 } })
  return NextResponse.json(doc ?? {})
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const col = await getUserSettings()
  await col.updateOne({ userId: session.userId }, { $set: body }, { upsert: true })
  return NextResponse.json({ ok: true })
}
