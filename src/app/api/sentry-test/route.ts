import * as Sentry from '@sentry/nextjs'

export async function GET() {
  // Endpoint diagnostyczny dostępny tylko w środowiskach nieprodukcyjnych.
  // Na produkcji zwracał Sentry events za każdym GET — łatwy DoS na quotę.
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not Found', { status: 404 })
  }

  const eventId = Sentry.captureMessage('Sentry test event', 'info')

  if (!eventId) {
    return Response.json(
      { ok: false, error: 'Sentry not initialized — check NEXT_PUBLIC_SENTRY_DSN and NODE_ENV' },
      { status: 500 }
    )
  }

  return Response.json({ ok: true, eventId })
}