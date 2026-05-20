'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/shared/supabase/server'
import { createAdminClient } from '@/shared/supabase/admin'
import { requireAdminSession } from './require-admin-session'
import { validateCommissionPct } from './validation'
import { logAdminAction } from './audit'
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

  // Ujednolicony komunikat — nie ujawnia czy konto istnieje ani jakiego ma roli.
  // Atakujący nie wie czy email należy do admina.
  if (error) return { message: 'Nieprawidłowy email lub hasło lub konto niezweryfikowane' }

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
    return { message: 'Nieprawidłowy email lub hasło lub konto niezweryfikowane' }
  }

  // Audit log — udane logowanie hasłem (przed MFA). Zapis przez service role,
  // bo użytkownik nie ma jeszcze aal2 i requireAdminSession by go odrzuciło.
  await logAdminAction({
    admin_id: user!.id,
    action: 'admin_login_password_ok',
    target_type: 'admin_user',
    target_id: user!.id,
  })

  // Proxy przekieruje na /admin/mfa/enroll lub /admin/mfa/verify zależnie od stanu MFA
  redirect('/admin/dashboard')
}


export async function markSessionPaid(sessionId: string): Promise<void> {
  const { adminId } = await requireAdminSession()

  const db = createAdminClient()
  await db
    .from('session_financials')
    .update({ paid_out_at: new Date().toISOString() })
    .eq('session_id', sessionId)
    .is('paid_out_at', null)

  await logAdminAction({
    admin_id: adminId,
    action: 'session_marked_paid',
    target_type: 'session',
    target_id: sessionId,
  })

  revalidatePath('/admin/sessions')
}

export async function updateCommissionPct(
  _state: ConfigFormState,
  formData: FormData
): Promise<ConfigFormState> {
  const { adminId } = await requireAdminSession()

  const value = (formData.get('commission_pct') as string | null) ?? ''
  const error = validateCommissionPct(value)
  if (error) return { errors: { commission_pct: error } }

  const db = createAdminClient()
  await db
    .from('platform_config')
    .update({ value })
    .eq('key', 'commission_pct')

  await logAdminAction({
    admin_id: adminId,
    action: 'commission_pct_updated',
    target_type: 'platform_config',
    target_id: 'commission_pct',
    payload: { value },
  })

  revalidatePath('/admin/config')
  return { success: true }
}

export async function toggleSubjectActive(
  subjectId: string,
  isActive: boolean
): Promise<void> {
  const { adminId } = await requireAdminSession()

  const db = createAdminClient()
  await db.from('subjects').update({ is_active: isActive }).eq('id', subjectId)

  await logAdminAction({
    admin_id: adminId,
    action: isActive ? 'subject_activated' : 'subject_deactivated',
    target_type: 'subject',
    target_id: subjectId,
  })

  revalidatePath('/admin/config')
}

export async function adminLogout(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/admin/login')
}
