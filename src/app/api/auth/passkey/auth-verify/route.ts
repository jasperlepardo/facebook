import { NextRequest, NextResponse } from 'next/server'
import { verifyAuthenticationResponse } from '@simplewebauthn/server'
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

  const passkey = (user.passkeys ?? []).find((p: any) => p.credentialID === credential.id)
  if (!passkey) return NextResponse.json({ error: 'Passkey not found' }, { status: 400 })

  let verification
  try {
    verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: user.currentChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: passkey.credentialID,
        publicKey: new Uint8Array(Buffer.from(passkey.publicKey, 'base64')),
        counter: passkey.counter,
        transports: passkey.transports ? JSON.parse(passkey.transports) : undefined,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }

  if (!verification.verified) return NextResponse.json({ error: 'Verification failed' }, { status: 400 })

  // Update counter
  const updatedPasskeys = (user.passkeys ?? []).map((p: any) =>
    p.credentialID === credential.id
      ? { ...p, counter: verification.authenticationInfo.newCounter }
      : p
  )

  await payload.update({
    collection: 'users',
    id: userId,
    data: { passkeys: updatedPasskeys, currentChallenge: null },
  })

  await createSession(userId)
  return NextResponse.json({ verified: true })
}
