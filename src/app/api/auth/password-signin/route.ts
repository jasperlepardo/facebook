import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getPayloadClient } from '@/lib/payload-access'
import { createSession } from '@/lib/session'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 })

  const payload = await getPayloadClient()
  try {
    const { user, token } = await payload.login({
      collection: 'users',
      data: { email, password },
    })
    await createSession(String(user.id), !!(user as any).superAdmin)
    // Use the token Payload already generated — guaranteed compatible
    if (token) {
      const jar = await cookies()
      jar.set('payload-token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }
}
