import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// This MUST be exported and named "middleware"
export function middleware(request: NextRequest) {
  return NextResponse.next()
}

// Optional: Define which paths the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}// Rate limiting & BSUID Auth Middleware