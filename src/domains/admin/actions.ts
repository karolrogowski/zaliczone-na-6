'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/shared/supabase/server'
import { createAdminClient } from '@/shared/supabase/admin'
import { validateCommissionPct } from './validation'
import type { AdminLoginFormState, ConfigFormState } from './types'

export async function adminLogin(
  _state: AdminLoginFormState,
  formData: FormData
): Promise<AdminLoginFormState> {
  const email = (formData.get('email') as string | null)?.trim() ?? ''
  const password = (formData.get('password') as string | null) ?? ''

  if (!email || !password) return { message: 'Uzupełnij email i hasło' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) return { message: 'Nieprawidłowy email lub hasło' }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single()

  if (profile?.role !== 'admin') {
    await supabase.auth.signOut()
    return { message: 'Nieprawidłowy email lub hasło' }
  }

  // Proxy przekieruje na /admin/mfa/enroll lub /admin/mfa/verify zależnie od stanu MFA
  redirect('/admin/dashboard')
}

async function requireAdminSession(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aal?.currentLevel !== 'aal2') redirect('/admin/mfa/verify')
}

export async function markSessionPaid(sessionId: string): Promise<void> {
  await requireAdminSession()

  const db = createAdminClient()
  await db
    .from('session_financials')
    .update({ paid_out_at: new Date().toISOString() })
    .eq('session_id', sessionId)
    .is('paid_out_at', null)

  revalidatePath('/admin/sessions')
}

export async function updateCommissionPct(
  _state: ConfigFormState,
  formData: FormData
): Promise<ConfigFormState> {
  await requireAdminSession()

  const value = (formData.get('commission_pct') as string | null) ?? ''
  const error = validateCommissionPct(value)
  if (error) return { errors: { commission_pct: error } }

  const db = createAdminClient()
  await db
    .from('platform_config')
    .update({ value })
    .eq('key', 'commission_pct')

  revalidatePath('/admin/config')
  return { success: true }
}

export async function toggleSubjectActive(
  subjectId: string,
  isActive: boolean
): Promise<void> {
  await requireAdminSession()

  const db = createAdminClient()
  await db.from('subjects').update({ is_active: isActive }).eq('id', subjectId)
  revalidatePath('/admin/config')
}

export async function adminLogout(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/admin/login')
}
