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

  // Allow social-preview crawlers through so OG meta tags are visible
  const ua = req.headers.get('user-agent') ?? ''
  if (/facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|WhatsApp|TelegramBot|Discordbot/i.test(ua)) {
    return NextResponse.next()
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

  // Auth API routes must be reachable before the user has a session (they ARE the login flow)
  if (pathname.startsWith('/api/auth/')) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/api/')) {
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.next()
  }

  if (!authed) {
    const next = encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)
    return NextResponse.redirect(new URL(`/auth/signin?next=${next}`, req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/admin/:path*', '/auth/:path*', '/api/:path*'],
}
