import { NextRequest, NextResponse } from 'next/server'
import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { getPayloadClient } from '@/lib/payload-access'

const RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost'

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')
  const payload = await getPayloadClient()

  if (email) {
    // Email provided: scope to that user's passkeys
    const result = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      limit: 1,
    })
    const user = result.docs[0]
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const allowCredentials = (user.passkeys ?? []).map((p: any) => ({
      id: p.credentialID,
      transports: p.transports ? JSON.parse(p.transports) : undefined,
    }))
    if (allowCredentials.length === 0) {
      return NextResponse.json({ error: 'No passkeys registered' }, { status: 400 })
    }

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials,
      userVerification: 'preferred',
    })
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { currentChallenge: options.challenge },
    })
    return NextResponse.json({ ...options, userId: user.id })
  }

  // Discoverable: let the browser pick the passkey
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: 'preferred',
  })
  const res = NextResponse.json(options)
  res.cookies.set('webauthn-challenge', options.challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 5,
    path: '/',
  })
  return res
}
