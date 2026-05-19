import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'
import { maintenanceMode } from './flags'
import {
  attachCsrfCookieIfMissing,
  isCsrfExempt,
  isMutatingMethod,
  verifyCsrf,
} from '@/lib/csrf'

// Security: CORS allowlist — no wildcards
const ALLOWED_ORIGINS = [
  'https://harvest21.com',
  'https://www.harvest21.com',
  'https://staging-m4.harvest21.com',
  'http://localhost:3000',
]

// CSRF enforcement is opt-in via env so we can soak the issuance path
// before flipping on verification. Default: enforce in production.
const CSRF_ENFORCED =
  process.env.CSRF_ENFORCEMENT === 'on' ||
  (process.env.CSRF_ENFORCEMENT !== 'off' && process.env.NODE_ENV === 'production')

function isMalformedPath(path: string): boolean {
  try {
    if (path.includes('%00') || path.includes('\0')) return true
    const once = decodeURIComponent(path)
    if (once.includes('\0')) return true
    if (/(\.\.[\\/])/.test(once)) return true
    if (once !== path && /%[0-9a-f]{2}/i.test(once)) {
      const twice = decodeURIComponent(once)
      if (twice.includes('\0')) return true
      if (/(\.\.[\\/])/.test(twice)) return true
    }
    return false
  } catch {
    return true
  }
}

function generateNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Build a per-request CSP header with a unique nonce.
 * The nonce replaces 'unsafe-inline' for script-src, eliminating XSS risk
 * from injected inline scripts while still allowing our own tagged scripts.
 * style-src keeps 'unsafe-inline' because Next.js injects inline styles.
 */
const CSP_STRICT_DYNAMIC = process.env.CSP_STRICT_DYNAMIC === 'on'

function buildCspHeader(nonce: string): string {
  const scriptSrc = CSP_STRICT_DYNAMIC
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: 'unsafe-inline'`
    : `script-src 'self' 'nonce-${nonce}' https://www.googletagmanager.com https://js.stripe.com`
  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co https://ui-avatars.com",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://*.supabase.co https://api.stripe.com https://www.google-analytics.com",
    "frame-src 'self' https://js.stripe.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ")
}
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (isMalformedPath(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/error/400'
    url.search = ''
    return NextResponse.rewrite(url)
  }

  const isMaintenance = await maintenanceMode()
  if (isMaintenance) {
    if (pathname === '/maintenance') return NextResponse.next()
    const url = request.nextUrl.clone()
    url.pathname = '/maintenance'
    return NextResponse.redirect(url)
  }
  if (pathname === '/maintenance') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }
  // Handle OPTIONS preflight requests for CORS
  if (request.method === 'OPTIONS') {
    const origin = request.headers.get('origin')

    const isAllowedOrigin =
      origin != null && (
        ALLOWED_ORIGINS.includes(origin) ||
        origin === request.nextUrl.origin
      )

    if (isAllowedOrigin) {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Max-Age': '86400',
        },
      })
    }

    // Security: reject preflight from unknown origins
    return new NextResponse(null, { status: 403 })
  }

  // Skip middleware for Next.js image optimization routes
  if (pathname.startsWith('/_next/image')) {
    return NextResponse.next()
  }

  // CSRF verification on mutating same-origin requests.
  // External webhooks are exempt — they have their own signature checks.
  if (
    CSRF_ENFORCED &&
    isMutatingMethod(request.method) &&
    !isCsrfExempt(pathname)
  ) {
    const ok = await verifyCsrf(request)
    if (!ok) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }
  }

  const nonce = generateNonce()
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-csp-nonce', nonce)

  const response = await updateSession(request)

  response.headers.set('x-csp-nonce', nonce)
  response.headers.set('Content-Security-Policy', buildCspHeader(nonce))

  await attachCsrfCookieIfMissing(request, response)

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
