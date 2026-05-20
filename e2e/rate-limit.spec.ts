/**
 * Testy rate-limitingu Supabase Auth.
 *
 * Wymagają świeżej instancji Supabase z licznikami GoTrue w 0.
 * W CI: osobny job ze świeżym runnerem i obniżonym limitem sign_in_sign_ups = 3.
 * Lokalnie: nie uruchamiać bez ręcznego obniżenia limitu w config.toml + restart Supabase.
 *
 * Uwaga: email_sent nie działa z lokalnym InBucket (wymaga zewnętrznego SMTP),
 * dlatego testujemy sign_in_sign_ups — limit niezależny od SMTP.
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

test('sign_in_sign_ups = 3 — czwarta próba logowania z tego samego IP zwraca 429', async () => {
  const client = anonClient()
  // Limit w CI obniżony do 3 przed startem Supabase (sed w kroku CI)
  const WRONG = 'wrong-password-xyz'

  const statuses: Array<number | undefined> = []
  for (const email of [STUDENT_EMAIL, TUTOR1_EMAIL, TUTOR2_EMAIL, STUDENT_EMAIL]) {
    const { error } = await client.auth.signInWithPassword({ email, password: WRONG })
    statuses.push(error?.status)
  }

  // Pierwsze 3: błąd logowania (nieprawidłowe hasło), ale w limicie
  for (let i = 0; i < 3; i++) {
    expect(statuses[i], `Próba ${i + 1}: powinna zwrócić błąd logowania, nie rate limit`).toBeDefined()
    expect(statuses[i], `Próba ${i + 1}: nie powinna być jeszcze rate-limitowana`).not.toBe(429)
  }
  // 4.: wyczerpany limit
  expect(statuses[3], 'Czwarta próba powinna zwrócić 429 Too Many Requests').toBe(429)
})
