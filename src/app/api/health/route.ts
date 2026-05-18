import { createClient } from '@/shared/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    // Minimalny ping — subjects są zawsze w bazie, RLS zwraca pusty wynik zamiast błędu
    const { error } = await supabase.from('subjects').select('id').limit(1)
    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 503 })
    }
    return Response.json({ ok: true })
  } catch (err) {
    return Response.json({ ok: false, error: String(err) }, { status: 503 })
  }
}
