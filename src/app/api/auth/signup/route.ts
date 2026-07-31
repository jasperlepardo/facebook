import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload-access'
import { createSession, getSession } from '@/lib/session'

export async function POST(req: NextRequest) {
  const { name, email, password } = await req.json()
  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Name, email and password required' }, { status: 400 })
  }

  const payload = await getPayloadClient()

  const userCount = await payload.count({ collection: 'users', overrideAccess: true })
  const isBootstrap = userCount.totalDocs === 0

  // After the first user, signup is closed unless ALLOW_SIGNUP=true or a superAdmin creates the account
  if (!isBootstrap) {
    const allowOpen = process.env.ALLOW_SIGNUP === 'true'
    const session = await getSession()
    if (!allowOpen && !session?.superAdmin) {
      return NextResponse.json(
        { error: 'Signups are closed. Ask an admin to create an account.' },
        { status: 403 },
      )
    }
  }

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
    data: {
      name,
      email,
      password,
      // First user on an empty install becomes superAdmin
      ...(isBootstrap ? { superAdmin: true } : {}),
    },
  })

  await createSession(String(user.id), isBootstrap)
  return NextResponse.json({ userId: user.id })
}
