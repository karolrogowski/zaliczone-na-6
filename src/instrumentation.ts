export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./env')
    if (process.env.NODE_ENV === 'production') {
      const { init } = await import('@sentry/nextjs')
      init({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN, tracesSampleRate: 0.1 })
    }
  }

  if (process.env.NEXT_RUNTIME === 'edge' && process.env.NODE_ENV === 'production') {
    const { init } = await import('@sentry/nextjs')
    init({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN, tracesSampleRate: 0.1 })
  }
}

export const onRequestError = async (err: unknown) => {
  const { captureException } = await import('@sentry/nextjs')
  captureException(err)
}