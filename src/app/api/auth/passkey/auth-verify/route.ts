import { NextRequest, NextResponse } from 'next/server'
import { verifyAuthenticationResponse } from '@simplewebauthn/server'
import { getPayloadClient } from '@/lib/payload-access'
import { createSession, setPayloadToken } from '@/lib/session'

const RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost'
const ORIGIN = process.env.WEBAUTHN_ORIGIN || 'http://localhost:3001'

export async function POST(req: NextRequest) {
  const { userId, credential } = await req.json()
  if (!credential) return NextResponse.json({ error: 'Missing credential' }, { status: 400 })

  const payload = await getPayloadClient()
  let user: any
  let passkey: any
  let challenge: string

  if (userId) {
    // Email flow: challenge stored on user record
    user = await payload.findByID({ collection: 'users', id: userId })
    if (!user?.currentChallenge) return NextResponse.json({ error: 'No challenge found' }, { status: 400 })
    challenge = user.currentChallenge
    passkey = (user.passkeys ?? []).find((p: any) => p.credentialID === credential.id)
  } else {
    // Discoverable flow: challenge stored in cookie, find user by credential ID
    challenge = req.cookies.get('webauthn-challenge')?.value ?? ''
    if (!challenge) return NextResponse.json({ error: 'No challenge found' }, { status: 400 })

    const all = await payload.find({ collection: 'users', limit: 100 })
    for (const u of all.docs) {
      const pk = (u.passkeys ?? []).find((p: any) => p.credentialID === credential.id)
      if (pk) { user = u; passkey = pk; break }
    }
  }

  if (!user || !passkey) return NextResponse.json({ error: 'Passkey not found' }, { status: 400 })

  let verification
  try {
    verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challenge,
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

  const updatedPasskeys = (user.passkeys ?? []).map((p: any) =>
    p.credentialID === credential.id
      ? { ...p, counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date().toISOString() }
      : p
  )
  await payload.update({
    collection: 'users',
    id: user.id,
    data: { passkeys: updatedPasskeys, currentChallenge: null },
  })

  await createSession(String(user.id), !!user.superAdmin)
  await setPayloadToken(String(user.id), user.email as string)

  const res = NextResponse.json({ verified: true })
  res.cookies.delete('webauthn-challenge')
  return res
}
