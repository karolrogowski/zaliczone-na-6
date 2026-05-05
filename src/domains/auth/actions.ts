'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/shared/supabase/server'
import type { LoginFormState, RegisterFormState, UserRole } from './types'

export async function register(
  _state: RegisterFormState,
  formData: FormData
): Promise<RegisterFormState> {
  const full_name = (formData.get('full_name') as string | null)?.trim() ?? ''
  const email = (formData.get('email') as string | null)?.trim() ?? ''
  const password = (formData.get('password') as string | null) ?? ''
  const role = (formData.get('role') as UserRole | null) ?? ('' as UserRole)

  const errors: NonNullable<RegisterFormState>['errors'] = {}

  if (full_name.length < 2)
    errors.full_name = ['Imię i nazwisko musi mieć co najmniej 2 znaki']
  if (!email)
    errors.email = ['Email jest wymagany']
  if (password.length < 8)
    errors.password = ['Hasło musi mieć co najmniej 8 znaków']
  if (!['student', 'tutor'].includes(role))
    errors.role = ['Wybierz rolę']

  if (Object.keys(errors).length > 0) return { errors }

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

  const errors: NonNullable<LoginFormState>['errors'] = {}

  if (!email) errors.email = ['Email jest wymagany']
  if (!password) errors.password = ['Hasło jest wymagane']

  if (Object.keys(errors).length > 0) return { errors }

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
