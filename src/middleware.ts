import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'jc-session-secret-change-in-production'
)

async function getSessionClaims(req: NextRequest): Promise<{ authed: boolean; superAdmin: boolean }> {
  const token = req.cookies.get('jc-session')?.value
  if (!token) return { authed: false, superAdmin: false }
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return { authed: true, superAdmin: !!(payload.superAdmin) }
  } catch {
    return { authed: false, superAdmin: false }
  }
}

export async function middleware(req: NextRequest) {
  if (process.env.SITE_DOWN === 'true') {
    return new NextResponse(null, { status: 404 })
  }

  const { pathname } = req.nextUrl
  const { authed, superAdmin } = await getSessionClaims(req)

  if (pathname.startsWith('/admin')) {
    if (!authed) return NextResponse.redirect(new URL('/auth/signin', req.url))
    if (!superAdmin) return NextResponse.redirect(new URL('/', req.url))
    return NextResponse.next()
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
  matcher: ['/', '/admin/:path*', '/auth/:path*', '/api/messages', '/api/attachments', '/api/jump', '/api/bookmark', '/api/hidden-items'],
}
