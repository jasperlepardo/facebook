import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET environment variable is not set')
}
const SECRET = new TextEncoder().encode(process.env.SESSION_SECRET)
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

export async function clearSession() {
  const jar = await cookies()
  jar.delete(COOKIE)
  jar.delete('payload-token')
}
