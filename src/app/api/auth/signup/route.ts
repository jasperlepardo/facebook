import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload-access'

export async function POST(req: NextRequest) {
  const { name, email } = await req.json()
  if (!name || !email) return NextResponse.json({ error: 'Name and email required' }, { status: 400 })

  const payload = await getPayloadClient()

  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
  }

  const user = await payload.create({
    collection: 'users',
    data: { name, email, password: crypto.randomUUID() },
  })

  return NextResponse.json({ userId: user.id })
}
