import 'server-only'
import { createClient } from '@supabase/supabase-js'

/** Klient z service role — omija RLS. Używać wyłącznie w Server Actions/Routes admina. */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
