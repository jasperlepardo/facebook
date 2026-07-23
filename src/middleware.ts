import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const token = req.cookies.get('payload-token')
  if (!token) {
    const login = new URL('/admin/login', req.url)
    login.searchParams.set('redirect', req.nextUrl.pathname)
    return NextResponse.redirect(login)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/api/messages', '/api/attachments', '/api/jump', '/api/bookmark'],
}
