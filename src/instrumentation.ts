import type { ErrorEvent } from '@sentry/nextjs'

// Wspólna konfiguracja PII scrubbing dla runtime'ów node i edge.
// Klient ma własną konfigurację w sentry.client.config.ts.
function scrubPii(event: ErrorEvent): ErrorEvent {
  if (event.user) {
    delete event.user.email
    delete event.user.ip_address
    delete event.user.username
  }
  if (event.request?.headers) {
    delete event.request.headers['cookie']
    delete event.request.headers['authorization']
  }
  if (event.request) {
    delete event.request.cookies
  }
  return event
}

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./env')
    if (process.env.NODE_ENV === 'production') {
      const { init } = await import('@sentry/nextjs')
      init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        tracesSampleRate: 0.1,
        sendDefaultPii: false,
        beforeSend: scrubPii,
      })
    }
  }

  if (process.env.NEXT_RUNTIME === 'edge' && process.env.NODE_ENV === 'production') {
    const { init } = await import('@sentry/nextjs')
    init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
      beforeSend: scrubPii,
    })
  }
}

export const onRequestError = async (err: unknown) => {
  const { captureException } = await import('@sentry/nextjs')
  captureException(err)
}