import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getPayloadClient } from '@/lib/payload-access'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json()
  const name  = String(body?.name ?? '').trim()
  const email = String(body?.email ?? '').trim()

  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })

  const payload = await getPayloadClient()

  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
  })
  if (existing.docs.length > 0 && String(existing.docs[0].id) !== String(session.userId)) {
    return NextResponse.json({ error: 'That email is already in use' }, { status: 409 })
  }

  try {
    await payload.update({ collection: 'users', id: session.userId, data: { name, email } })
  } catch {
    return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 })
  }

  return NextResponse.json({ name, email })
}
