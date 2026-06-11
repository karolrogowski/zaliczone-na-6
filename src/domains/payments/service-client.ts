import 'server-only'
import { createClient } from '@supabase/supabase-js'

/**
 * Klient z service role dla webhooka Stripe — zdarzenia przychodzą bez sesji
 * użytkownika, więc aktualizacja statusu płatności wymaga ominięcia RLS.
 */
export function createPaymentsServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
