import * as Sentry from '@sentry/nextjs'

export async function GET() {
  const eventId = Sentry.captureMessage('Sentry test event', 'info')

  if (!eventId) {
    return Response.json(
      { ok: false, error: 'Sentry not initialized — check NEXT_PUBLIC_SENTRY_DSN and NODE_ENV' },
      { status: 500 }
    )
  }

  return Response.json({ ok: true, eventId })
}
