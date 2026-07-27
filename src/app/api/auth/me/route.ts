import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getPayloadClient } from '@/lib/payload-access'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const payload = await getPayloadClient()
  const user = await payload.findByID({ collection: 'users', id: session.userId })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    passkeys: (user.passkeys ?? []).map((p: any) => ({
      credentialID: p.credentialID,
      deviceType: p.deviceType,
      backedUp: p.backedUp,
    })),
  })
}
