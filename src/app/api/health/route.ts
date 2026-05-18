export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    return Response.json(
      { ok: false, error: 'Brak zmiennych środowiskowych Supabase' },
      { status: 503 }
    )
  }

  try {
    // GoTrue /health — dedykowany endpoint health auth serwisu Supabase, nie wymaga klucza
    const res = await fetch(`${url}/auth/v1/health`, {
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) {
      return Response.json(
        { ok: false, error: `Supabase auth health zwrócił ${res.status}` },
        { status: 503 }
      )
    }

    return Response.json({ ok: true })
  } catch (err) {
    return Response.json(
      { ok: false, error: `Nie można połączyć się z Supabase: ${err}` },
      { status: 503 }
    )
  }
}
