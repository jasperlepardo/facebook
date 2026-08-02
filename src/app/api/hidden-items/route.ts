import { ObjectId } from 'mongodb'
import { NextRequest, NextResponse } from 'next/server'
import { getHiddenItems } from '@/lib/db'
import { getSession } from '@/lib/session'
import { getPayloadClient } from '@/lib/payload-access'
import { invalidateHiddenFilterCache } from '@/lib/hidden-filter-cache'
import { bumpHiddenSyncVersion } from '@/lib/hidden-sync'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS })
}

async function requireSuperAdmin() {
  const session = await getSession()
  if (!session) return null
  const payload = await getPayloadClient()
  const user = await payload.findByID({ collection: 'users', id: session.userId })
  if (!(user as any)?.superAdmin) return null
  return user
}

// GET — list all hidden items
export async function GET() {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: CORS })

  const col = await getHiddenItems()
  const items = await col.find().sort({ createdAt: -1 }).toArray()
  return NextResponse.json({
    items: items.map(i => ({ ...i, _id: String(i._id) }))
  }, { headers: CORS })
}

// POST { type, value, note? } — add a hidden item
export async function POST(req: NextRequest) {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: CORS })

  const { type, value, note } = await req.json()
  if (!type || !value) return NextResponse.json({ error: 'type and value required' }, { status: 400, headers: CORS })
  if (type !== 'message' && type !== 'uri') return NextResponse.json({ error: 'type must be message or uri' }, { status: 400, headers: CORS })

  const col = await getHiddenItems()
  // Upsert — avoid duplicates
  await col.updateOne(
    { type, value },
    { $set: { type, value, note: note ?? '', createdAt: new Date().toISOString(), createdBy: (user as any).name ?? '' } },
    { upsert: true }
  )
  const item = await col.findOne({ type, value })
  if (type === 'message') invalidateHiddenFilterCache()
  await bumpHiddenSyncVersion()
  return NextResponse.json({ item: { ...item, _id: String(item!._id) } }, { headers: CORS })
}

// DELETE ?id=xxx — remove a hidden item by _id
export async function DELETE(req: NextRequest) {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: CORS })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400, headers: CORS })

  const col = await getHiddenItems()
  await col.deleteOne({ _id: new ObjectId(id) })
  invalidateHiddenFilterCache()
  await bumpHiddenSyncVersion()
  return NextResponse.json({ ok: true }, { headers: CORS })
}
