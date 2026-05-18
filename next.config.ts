import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'geolocation=()' },
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