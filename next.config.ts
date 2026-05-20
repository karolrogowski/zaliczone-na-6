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
    `script-src 'self' 'unsafe-inline' ${process.env.NODE_ENV === 'production' ? '' : "'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${supabaseHttp} ${supabaseWs} https://*.sentry.io https://*.ingest.sentry.io https://api.whereby.dev`,
    "frame-src 'self' https://*.whereby.com https://*.whereby.dev",
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

const nextConfig: NextConfig = {
  headers: async () => [
    { source: '/(.*)', headers: securityHeaders },
  ],
}

export default withSentryConfig(nextConfig, {
  silent: true,
  sourcemaps: { disable: true },
  telemetry: false,
  webpack: { treeshake: { removeDebugLogging: true } },
})