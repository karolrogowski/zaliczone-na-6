import 'server-only'
import { createClient } from '@/shared/supabase/server'
import type { User } from '@supabase/supabase-js'

/**
 * Zwraca zalogowanego użytkownika lub rzuca błąd jeśli niezalogowany.
 * Użyj w server actions gdzie brak auth = błąd krytyczny.
 */
export async function getCurrentUser(): Promise<User> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Nie jesteś zalogowany.')
  return user
}

/**
 * Zwraca zalogowanego użytkownika lub null.
 * Użyj gdy brak auth = graceful fallback (np. form state error).
 */
export async function getCurrentUserOrNull(): Promise<User | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ?? null
}