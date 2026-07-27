import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getPayloadClient } from '@/lib/payload-access'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { credentialID, nickname } = await req.json()
  if (!credentialID) return NextResponse.json({ error: 'credentialID required' }, { status: 400 })

  const payload = await getPayloadClient()
  const user = await payload.findByID({ collection: 'users', id: session.userId })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const updated = (user.passkeys ?? []).map((p: any) =>
    p.credentialID === credentialID ? { ...p, nickname: nickname ?? '' } : p
  )
  await payload.update({ collection: 'users', id: session.userId, data: { passkeys: updated } })

  return NextResponse.json({ ok: true })
}
