import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

function getSessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    throw new Error('SESSION_SECRET environment variable is not set')
  }
  return new TextEncoder().encode(secret)
}

async function getSessionClaims(req: NextRequest): Promise<{ authed: boolean; superAdmin: boolean }> {
  const token = req.cookies.get('jc-session')?.value
  if (!token) return { authed: false, superAdmin: false }
  try {
    const { payload } = await jwtVerify(token, getSessionSecret())
    return { authed: true, superAdmin: !!(payload.superAdmin) }
  } catch {
    return { authed: false, superAdmin: false }
  }
}

const CRAWLER_RE = /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|WhatsApp|TelegramBot|Discordbot/i

/** Routes crawlers may hit without a session (OG previews only). */
function isCrawlerAllowedPath(pathname: string): boolean {
  return pathname === '/' || pathname === '/api/og'
}

export async function middleware(req: NextRequest) {
  if (process.env.SITE_DOWN === 'true') {
    return new NextResponse(null, { status: 404 })
  }

  const { pathname } = req.nextUrl
  const ua = req.headers.get('user-agent') ?? ''

  // Social crawlers: only OG HTML + image — never private APIs
  if (CRAWLER_RE.test(ua) && isCrawlerAllowedPath(pathname)) {
    return NextResponse.next()
  }

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
  matcher: [
    '/',
    '/admin/:path*',
    '/auth/:path*',
    '/api/:path*',
    '/upload/:path*',
    '/dev/:path*',
  ],
}
