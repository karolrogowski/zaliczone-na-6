import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

// CSP — dane URL Supabase i Sentry pobieramy z env, żeby działało w dev (127.0.0.1:54321)
// i na produkcji (*.supabase.co). Wildcard dla Supabase pokrywa też kanały Realtime przez wss://.
function buildCSP(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const supabaseOrigin = supabaseUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  const supabaseHttp = supabaseUrl ? `https://${supabaseOrigin} http://${supabaseOrigin}` : ''
  const supabaseWs = supabaseUrl ? `wss://${supabaseOrigin} ws://${supabaseOrigin}` : ''

  return [
    "default-src 'self'",
    // Next.js w buildzie produkcyjnym potrzebuje 'unsafe-inline' (inline scripts dla hydratacji)
    // oraz w dev 'unsafe-eval' (HMR). Bez nonce — w MVP akceptowalne.
    // js.stripe.com — Stripe.js (Stripe Elements, krok 4 płatności).
    `script-src 'self' 'unsafe-inline' https://js.stripe.com ${process.env.NODE_ENV === 'production' ? '' : "'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${supabaseHttp} ${supabaseWs} https://*.sentry.io https://*.ingest.sentry.io https://api.whereby.dev https://api.stripe.com`,
    "frame-src 'self' https://*.whereby.com https://*.whereby.dev https://js.stripe.com https://hooks.stripe.com",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].filter(Boolean).join('; ')
}

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'geolocation=()' },
  { key: 'Content-Security-Policy', value: buildCSP() },
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
    : []),
]

// Trasy z PII użytkownika — jawnie wymuszamy brak cache (defense in depth;
// Next domyślnie nie cache'uje dynamic routes, ale jawny nagłówek chroni
// przed konfiguracjami proxy/CDN, które mogłyby coś niechcąco zapamiętać).
const noStoreHeader = { key: 'Cache-Control', value: 'private, no-store, max-age=0' }

const nextConfig: NextConfig = {
  headers: async () => [
    { source: '/(.*)', headers: securityHeaders },
    { source: '/settings/:path*', headers: [noStoreHeader] },
    { source: '/profile/:path*', headers: [noStoreHeader] },
    { source: '/history/:path*', headers: [noStoreHeader] },
    { source: '/session/:path*', headers: [noStoreHeader] },
    { source: '/admin/:path*', headers: [noStoreHeader] },
  ],
}

export default withSentryConfig(nextConfig, {
  silent: true,
  sourcemaps: { disable: true },
  telemetry: false,
  webpack: { treeshake: { removeDebugLogging: true } },
})