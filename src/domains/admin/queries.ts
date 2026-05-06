import { cache } from 'react'
import { createAdminClient } from '@/shared/supabase/admin'
import type { AdminSession, AdminStats, AdminUser } from './types'

export const getAdminStats = cache(async (): Promise<AdminStats> => {
  const db = createAdminClient()

  const [{ count: totalSessions }, { count: totalUsers }, { data: financials }] =
    await Promise.all([
      db.from('sessions').select('*', { count: 'exact', head: true }),
      db.from('profiles').select('*', { count: 'exact', head: true }),
      db
        .from('session_financials')
        .select('tutor_earning_grosz')
        .is('paid_out_at', null),
    ])

  const pendingPayoutGrosze = (financials ?? []).reduce(
    (sum, f) => sum + (f.tutor_earning_grosz ?? 0),
    0
  )

  return {
    totalSessions: totalSessions ?? 0,
    totalUsers: totalUsers ?? 0,
    pendingPayoutGrosze,
  }
})

export const getAdminSessions = cache(async (): Promise<AdminSession[]> => {
  const db = createAdminClient()
  const { data } = await db
    .from('sessions')
    .select(`
      id, status, started_at, ended_at, duration_minutes, student_id, tutor_id,
      student:profiles!sessions_student_id_fkey(full_name),
      tutor:profiles!sessions_tutor_id_fkey(full_name),
      matching_requests(subjects(label)),
      session_financials(student_cost_grosz, tutor_earning_grosz, platform_commission_grosz, paid_out_at)
    `)
    .order('created_at', { ascending: false })

  return (data ?? []) as unknown as AdminSession[]
})

export const getAdminUsers = cache(async (): Promise<AdminUser[]> => {
  const db = createAdminClient()

  const [{ data: profiles }, { data: authData }] = await Promise.all([
    db
      .from('profiles')
      .select(`
        id, role, full_name, created_at,
        tutor_profiles(hourly_rate_grosz, is_available, rating_avg, rating_count)
      `)
      .order('created_at', { ascending: false }),
    db.auth.admin.listUsers(),
  ])

  const authMap = new Map(
    (authData?.users ?? []).map((u) => [
      u.id,
      { email: u.email, email_confirmed_at: u.email_confirmed_at },
    ])
  )

  return (profiles ?? []).map((p) => ({
    ...p,
    ...authMap.get(p.id),
  })) as unknown as AdminUser[]
})

export const getPlatformConfig = cache(async () => {
  const db = createAdminClient()
  const { data } = await db.from('platform_config').select('key, value, description')
  return data ?? []
})

export const getAdminSubjects = cache(async () => {
  const db = createAdminClient()
  const { data } = await db.from('subjects').select('id, label, is_active').order('label')
  return data ?? []
})
