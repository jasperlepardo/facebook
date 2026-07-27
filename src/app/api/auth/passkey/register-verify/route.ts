import { NextRequest, NextResponse } from 'next/server'
import { verifyRegistrationResponse } from '@simplewebauthn/server'
import { getPayloadClient } from '@/lib/payload-access'
import { createSession } from '@/lib/session'

const RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost'
const ORIGIN = process.env.WEBAUTHN_ORIGIN || 'http://localhost:3001'

export async function POST(req: NextRequest) {
  const { userId, credential } = await req.json()
  if (!userId || !credential) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const payload = await getPayloadClient()
  const user = await payload.findByID({ collection: 'users', id: userId })
  if (!user?.currentChallenge) return NextResponse.json({ error: 'No challenge found' }, { status: 400 })

  let verification
  try {
    verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: user.currentChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: 'Verification failed' }, { status: 400 })
  }

  const { credential: cred, credentialDeviceType, credentialBackedUp } = verification.registrationInfo

  const passkeys = [
    ...(user.passkeys ?? []),
    {
      credentialID: cred.id,
      publicKey: Buffer.from(cred.publicKey).toString('base64'),
      counter: cred.counter,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      transports: JSON.stringify(credential.response?.transports ?? []),
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
    },
  ]

  await payload.update({
    collection: 'users',
    id: userId,
    data: { passkeys, currentChallenge: null },
  })

  await createSession(userId)
  return NextResponse.json({ verified: true })
}
