import { NextRequest, NextResponse } from 'next/server'
import { generateRegistrationOptions } from '@simplewebauthn/server'
import { getPayloadClient } from '@/lib/payload-access'

const RP_NAME = 'Resibo'
const RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost'

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const payload = await getPayloadClient()
  const user = await payload.findByID({ collection: 'users', id: userId })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const existingCredentials = (user.passkeys ?? []).map((p: any) => ({
    id: p.credentialID,
    transports: p.transports ? (JSON.parse(p.transports) as AuthenticatorTransport[]) : undefined,
  }))

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: user.email as string,
    userDisplayName: user.name,
    attestationType: 'none',
    excludeCredentials: existingCredentials,
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  })

  await payload.update({
    collection: 'users',
    id: userId,
    data: { currentChallenge: options.challenge },
  })

  return NextResponse.json(options)
}
