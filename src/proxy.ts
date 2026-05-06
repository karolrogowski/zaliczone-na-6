import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PROTECTED_PREFIXES = ['/dashboard', '/matching', '/session']
const AUTH_ONLY_ROUTES = ['/login', '/register', '/forgot-password', '/check-email']
const ADMIN_PUBLIC = ['/admin/login', '/admin/mfa']

export async function proxy(request: NextRequest) {
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

  // ── Trasy admina ──────────────────────────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    const isAdminPublic = ADMIN_PUBLIC.some((p) => pathname.startsWith(p))

    if (!user) {
      if (isAdminPublic) return supabaseResponse
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    // Sprawdź rolę admina
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
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
