import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { updateUserLastActivity } from '@/lib/userActivityHelpers'
import { reportServerError } from '@/lib/errorReporting'

const cookieOptions = {
  path: '/',
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  httpOnly: true,
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => 
            supabaseResponse.cookies.set(name, value, { ...cookieOptions, ...options })
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.
  // IMPORTANT: Don't remove getClaims()
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims

  const pathname = request.nextUrl.pathname
  const isApiRoute = pathname.startsWith('/api')
  const isAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password')
  const isAdminRoute = pathname.startsWith('/admin')
  const isPublicRoute =
    pathname === '/' ||
    pathname.startsWith('/missionaries') ||
    pathname.startsWith('/countries') ||
    (pathname.length > 1 && !pathname.startsWith('/_') && pathname.split('/').length === 2 && !isAdminRoute)

  if (isApiRoute) {
    return supabaseResponse
  }

  const redirectTo = (targetPath: string) => {
    const url = request.nextUrl.clone()
    url.pathname = targetPath
    const response = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie)
    })
    return response
  }

  if (!user && !isPublicRoute && !isAuthRoute && !isAdminRoute) {
    return redirectTo('/')
  }

  if (isAdminRoute) {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (!authUser) {
      return redirectTo('/')
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('user_id', authUser.id)
      .single()

    const isAdmin = userData?.role === 1 || userData?.role === 2

    if (!isAdmin) {
      return redirectTo('/')
    }
  }

  // Update last_activity for authenticated users on protected routes
  // Skip for API routes, static assets, and public routes to avoid unnecessary updates
  if (user && !isApiRoute && !isPublicRoute && !isAuthRoute) {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()
    if (authUser?.id) {
      updateUserLastActivity(authUser.id).catch((error) => {
        reportServerError(error, {
          path: pathname,
          userId: authUser.id,
          extra: { detail: 'update_last_activity_failed_middleware' },
        });
      });
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse
}

