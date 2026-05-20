import * as Sentry from '@sentry/nextjs'

if (process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0,
    // PII scrubbing — domyślnie Sentry zbiera email, IP, headers z requestu.
    // Wyłączamy zbieranie defaultowe i ręcznie czyścimy event w beforeSend.
    sendDefaultPii: false,
    integrations: [
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
    beforeSend(event) {
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
    },
  })
}