import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'jc-session-secret-change-in-production'
)

async function isAuthenticated(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get('jc-session')?.value
  if (!token) return false
  try {
    await jwtVerify(token, SECRET)
    return true
  } catch {
    return false
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const authed = await isAuthenticated(req)

  if (pathname.startsWith('/admin')) {
    return NextResponse.redirect(new URL(authed ? '/' : '/auth/signin', req.url))
  }

  if (pathname.startsWith('/auth/')) {
    if (authed) return NextResponse.redirect(new URL('/', req.url))
    return NextResponse.next()
  }

  if (!authed) {
    return NextResponse.redirect(new URL('/auth/signin', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/admin/:path*', '/auth/:path*', '/api/messages', '/api/attachments', '/api/jump', '/api/bookmark'],
}
