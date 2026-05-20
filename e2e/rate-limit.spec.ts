/**
 * Testy rate-limitingu Supabase Auth.
 *
 * Wymagają świeżej instancji Supabase (liczniki GoTrue w pamięci = 0).
 * W CI uruchamiane w osobnym jobie ze świeżym runnerem.
 * Lokalnie: npx supabase stop && npx supabase start
 *
 * Nie używają przeglądarki — wywołują Supabase API bezpośrednio z Node.js.
 */

import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { STUDENT_EMAIL, TUTOR1_EMAIL, TUTOR2_EMAIL } from './global-setup'

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

test('email_sent = 2 — trzecia próba wysłania emaila w ciągu godziny zwraca 429', async () => {
  const client = anonClient()

  // Trzy różne adresy — unikamy limitu max_frequency per-adres (1s)
  const { error: e1 } = await client.auth.resetPasswordForEmail(STUDENT_EMAIL)
  const { error: e2 } = await client.auth.resetPasswordForEmail(TUTOR1_EMAIL)
  const { error: e3 } = await client.auth.resetPasswordForEmail(TUTOR2_EMAIL)

  expect(e1, 'Pierwsze żądanie powinno być zaakceptowane').toBeNull()
  expect(e2, 'Drugie żądanie powinno być zaakceptowane').toBeNull()
  expect(e3?.status, 'Trzecie żądanie powinno zwrócić 429 Too Many Requests').toBe(429)
})
