import { NextRequest, NextResponse } from 'next/server'
import { getSession, createSession } from '@/lib/session'
import { getPayloadClient } from '@/lib/payload-access'

const MIN_LENGTH = 6

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { currentPassword, newPassword } = await req.json()
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Current and new password required' }, { status: 400 })
  }
  if (String(newPassword).length < MIN_LENGTH) {
    return NextResponse.json({ error: `Password must be at least ${MIN_LENGTH} characters` }, { status: 400 })
  }

  const payload = await getPayloadClient()
  const user = await payload.findByID({ collection: 'users', id: session.userId })
  if (!user?.email) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  try {
    await payload.login({ collection: 'users', data: { email: user.email, password: currentPassword } })
  } catch {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
  }

  try {
    await payload.update({ collection: 'users', id: session.userId, data: { password: newPassword } })
  } catch {
    return NextResponse.json({ error: 'Failed to update password' }, { status: 500 })
  }

  // Keep this device signed in — the session cookie is independent of the password.
  await createSession(String(session.userId), session.superAdmin)

  return NextResponse.json({ ok: true })
}
