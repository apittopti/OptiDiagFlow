import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Configuration for request size limits
const MAX_REQUEST_SIZE = 10 * 1024 * 1024 // 10MB for file uploads
const MAX_JSON_SIZE = 1 * 1024 * 1024 // 1MB for JSON payloads

// Protected routes that require authentication
const protectedRoutes = [
  '/dashboard',
  '/jobs',
  '/vehicle-management',
  '/odx-editor',
  '/settings',
  '/odx-management',
  '/odx-knowledge',
  '/oem'
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check if the path is protected
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))

  // Check authentication for protected routes
  if (isProtectedRoute || pathname === '/') {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET
    })

    if (!token) {
      // Redirect to login if not authenticated
      const url = new URL('/auth/signin', request.url)
      url.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(url)
    }
  }

  // Redirect root to dashboard if authenticated
  if (pathname === '/') {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET
    })

    if (token) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // CORS headers for API routes
  if (pathname.startsWith('/api/')) {
    const response = NextResponse.next()

    // Add CORS headers
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: response.headers })
    }

    // Check Content-Length for size limits
    const contentLength = request.headers.get('content-length')
    if (contentLength) {
      const size = parseInt(contentLength)

      // Different limits for upload endpoint vs other endpoints
      if (pathname === '/api/upload') {
        if (size > MAX_REQUEST_SIZE) {
          return NextResponse.json(
            { error: 'File too large. Maximum size is 10MB' },
            { status: 413 }
          )
        }
      } else {
        if (size > MAX_JSON_SIZE) {
          return NextResponse.json(
            { error: 'Request too large. Maximum size is 1MB' },
            { status: 413 }
          )
        }
      }
    }

    // Add security headers
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-XSS-Protection', '1; mode=block')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Protected routes
    '/((?!api/auth|_next/static|_next/image|favicon.ico|auth).*)',
    // API routes
    '/api/:path*'
  ]
}