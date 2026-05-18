import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  prefix: 'rl:auth',
})

const RATE_LIMITED_ROUTES = ['/login', '/register', '/forgot-password']

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/matching',
  '/session',
  '/request',
  '/rate',
  '/profile',
  '/settings',
  '/history',
  '/tutor',
]
const AUTH_ONLY_ROUTES = ['/login', '/register', '/forgot-password', '/check-email']
const ADMIN_PUBLIC = ['/admin/login', '/admin/mfa']

export async function proxy(request: NextRequest) {
  if (
    request.method === 'POST' &&
    process.env.NODE_ENV !== 'development' &&
    RATE_LIMITED_ROUTES.some(r => request.nextUrl.pathname.startsWith(r))
  ) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
    const { success } = await ratelimit.limit(ip)
    if (!success) {
      return NextResponse.json(
        { error: 'Zbyt wiele prób. Poczekaj chwilę i spróbuj ponownie.' },
        { status: 429 }
      )
    }
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // WAŻNE: nie umieszczaj kodu między createServerClient a getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // ── Wymuszenie re-logowania admina po 1h (wszystkie trasy) ────────────────
  // Zastępstwo za Supabase auth.sessions.timebox (wymaga planu Pro).
  if (user && user.user_metadata?.role === 'admin') {
    const ADMIN_SESSION_MAX_AGE_MS = 60 * 60 * 1000
    const lastSignIn = user.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : 0
    if (Date.now() - lastSignIn > ADMIN_SESSION_MAX_AGE_MS) {
      await supabase.auth.signOut()
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  // ── Trasy admina ──────────────────────────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    const isAdminPublic = ADMIN_PUBLIC.some((p) => pathname.startsWith(p))

    if (!user) {
      if (isAdminPublic) return supabaseResponse
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    // Rola jest w user_metadata (ustawiana przy rejestracji/tworzeniu konta) — bez DB round-trip.
    // Middleware to warstwa routingu; ostateczna weryfikacja jest w requireAdminSession() w actions.
    if (user.user_metadata?.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    if (isAdminPublic) {
      // Zalogowany admin na /admin/login → sprawdź czy ma już aal2
      if (pathname === '/admin/login') {
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        if (aal?.currentLevel === 'aal2') {
          return NextResponse.redirect(new URL('/admin/dashboard', request.url))
        }
      }
      return supabaseResponse
    }

    // Trasy panelu wymagają aal2
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aal?.currentLevel !== 'aal2') {
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const hasTotp = (factors?.totp?.length ?? 0) > 0
      return NextResponse.redirect(
        new URL(hasTotp ? '/admin/mfa/verify' : '/admin/mfa/enroll', request.url)
      )
    }

    return supabaseResponse
  }

  // ── Zwykłe trasy ─────────────────────────────────────────────────────────
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))
  const isAuthOnly = AUTH_ONLY_ROUTES.some((p) => pathname.startsWith(p))

  if (!user && isProtected) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isAuthOnly) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
