'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/shared/supabase/server'
import type { LoginFormState, RegisterFormState, UserRole } from './types'
import { validateLoginForm, validateRegisterForm } from './validation'

export async function register(
  _state: RegisterFormState,
  formData: FormData
): Promise<RegisterFormState> {
  const full_name = (formData.get('full_name') as string | null)?.trim() ?? ''
  const email = (formData.get('email') as string | null)?.trim() ?? ''
  const password = (formData.get('password') as string | null) ?? ''
  const role = (formData.get('role') as UserRole | null) ?? ('' as UserRole)

  const validationError = validateRegisterForm({ full_name, email, password, role })
  if (validationError) return validationError

  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role, full_name },
    },
  })

  if (error) {
    if (error.code === 'user_already_exists') {
      return { errors: { email: ['Konto z tym adresem email już istnieje'] } }
    }
    return { message: 'Wystąpił błąd podczas rejestracji. Spróbuj ponownie.' }
  }

  redirect('/dashboard')
}

export async function login(
  _state: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  const email = (formData.get('email') as string | null)?.trim() ?? ''
  const password = (formData.get('password') as string | null) ?? ''

  const validationError = validateLoginForm({ email, password })
  if (validationError) return validationError

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { message: 'Nieprawidłowy email lub hasło' }
  }

  redirect('/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
