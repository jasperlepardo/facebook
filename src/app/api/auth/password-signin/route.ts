import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload-access'
import { createSession } from '@/lib/session'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 })

  const payload = await getPayloadClient()
  try {
    const { user } = await payload.login({
      collection: 'users',
      data: { email, password },
    })
    await createSession(String(user.id), !!(user as any).superAdmin)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }
}
