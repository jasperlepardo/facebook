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
  if (!(await isAuthenticated(req))) {
    const signin = new URL('/auth/signin', req.url)
    return NextResponse.redirect(signin)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/api/messages', '/api/attachments', '/api/jump', '/api/bookmark'],
}
