import { NextResponse } from 'next/server'
import { ADMIN_COOKIE, RESIDENT_COOKIE, SESSION_COOKIE, verifyAdminToken, verifyResidentToken, verifyToken } from '@/lib/auth'

const ADMIN_PUBLIC = ['/admin/login', '/admin/accept-invite']

// Server-side gates for the owner dashboard and the admin console. The APIs
// re-check every request, so this only decides where to send the browser.
export async function middleware(request) {
  const { pathname, search } = request.nextUrl

  if (pathname.startsWith('/admin')) {
    const admin = await verifyAdminToken(request.cookies.get(ADMIN_COOKIE)?.value).catch(() => null)
    const isPublic = ADMIN_PUBLIC.some(p => pathname === p || pathname.startsWith(`${p}/`))
    if (!admin && !isPublic) {
      const url = new URL('/admin/login', request.url)
      if (pathname !== '/admin') url.searchParams.set('next', pathname + search)
      return NextResponse.redirect(url)
    }
    if (admin && pathname === '/admin/login') return NextResponse.redirect(new URL('/admin', request.url))
    const response = NextResponse.next()
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
    return response
  }

  // Tenant app: /t is the phone sign-in, everything under it needs a resident session.
  if (pathname === '/t' || pathname.startsWith('/t/')) {
    const resident = await verifyResidentToken(request.cookies.get(RESIDENT_COOKIE)?.value).catch(() => null)
    if (!resident && pathname !== '/t') return NextResponse.redirect(new URL('/t', request.url))
    if (resident && pathname === '/t') return NextResponse.redirect(new URL('/t/home', request.url))
    return NextResponse.next()
  }

  const session = await verifyToken(request.cookies.get(SESSION_COOKIE)?.value).catch(() => null)
  if (pathname.startsWith('/dashboard') && !session) {
    const url = new URL('/login', request.url)
    url.searchParams.set('next', pathname + search)
    return NextResponse.redirect(url)
  }
  if ((pathname === '/login' || pathname === '/signup') && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/signup', '/admin', '/admin/:path*', '/t', '/t/:path*'],
}
