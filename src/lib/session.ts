import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'jc-session-secret-change-in-production'
)
const PAYLOAD_SECRET = new TextEncoder().encode(
  process.env.PAYLOAD_SECRET || 'ciara-notes-secret-key'
)
const COOKIE = 'jc-session'
const EXPIRES = 60 * 60 * 24 * 30 // 30 days

export async function createSession(userId: string, superAdmin = false) {
  const token = await new SignJWT({ sub: userId, superAdmin })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(SECRET)

  const jar = await cookies()
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: EXPIRES,
    path: '/',
  })
}

export async function getSession(): Promise<{ userId: string; superAdmin: boolean } | null> {
  const jar = await cookies()
  const token = jar.get(COOKIE)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return { userId: payload.sub as string, superAdmin: !!(payload.superAdmin) }
  } catch {
    return null
  }
}

export async function setPayloadToken(userId: string, email: string) {
  const token = await new SignJWT({ id: userId, collection: 'users', email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(PAYLOAD_SECRET)

  const jar = await cookies()
  jar.set('payload-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: EXPIRES,
    path: '/',
  })
}

export async function clearSession() {
  const jar = await cookies()
  jar.delete(COOKIE)
  jar.delete('payload-token')
}
