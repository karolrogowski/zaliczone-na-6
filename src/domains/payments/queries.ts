import { createClient } from '@/shared/supabase/server'
import { getStripeClient } from './stripe-client'
import type { TutorBalance, TutorEarningRow, TutorStripeState } from './types'

export async function getSessionPriceGrosz(): Promise<number> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('platform_config')
    .select('value')
    .eq('key', 'session_price_grosz')
    .single()

  return data ? parseInt(data.value, 10) : 10000
}

/** Własny wiersz tutor_profiles z polami Stripe (RLS: SELECT własnego wiersza). */
async function getOwnTutorStripeRow(): Promise<{
  stripe_account_id: string | null
  stripe_onboarding_done: boolean
} | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('tutor_profiles')
    .select('stripe_account_id, stripe_onboarding_done')
    .eq('id', user.id)
    .maybeSingle()

  return data ?? null
}

/**
 * Stan konta Stripe Connect zalogowanego korepetytora.
 * RLS pozwala korepetytorowi czytać własny wiersz tutor_profiles.
 */
export async function getOwnTutorStripeState(): Promise<TutorStripeState> {
  const row = await getOwnTutorStripeRow()
  return {
    hasAccount: Boolean(row?.stripe_account_id),
    onboardingDone: Boolean(row?.stripe_onboarding_done),
  }
}

/**
 * Saldo Stripe korepetytora (dostępne + oczekujące, w groszach PLN).
 * Zwraca null, gdy korepetytor nie ukończył onboardingu Connect.
 */
export async function getTutorBalance(): Promise<TutorBalance | null> {
  const row = await getOwnTutorStripeRow()
  if (!row?.stripe_account_id || !row.stripe_onboarding_done) return null

  try {
    const balance = await getStripeClient().balance.retrieve(
      {},
      { stripeAccount: row.stripe_account_id }
    )
    const sumPln = (parts: { amount: number; currency: string }[]) =>
      parts.filter((p) => p.currency === 'pln').reduce((sum, p) => sum + p.amount, 0)

    return {
      availableGrosz: sumPln(balance.available),
      pendingGrosz: sumPln(balance.pending),
    }
  } catch (err) {
    console.error('[payments] Nie udało się pobrać salda korepetytora:', err)
    return null
  }
}

/**
 * Historia zarobków korepetytora z ewidencji session_financials
 * (RLS: korepetytor czyta wiersze swoich sesji).
 */
export async function getTutorEarningsHistory(limit = 10): Promise<TutorEarningRow[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('session_financials')
    .select('id, tutor_earning_grosz, transfer_pending, created_at, sessions!inner(tutor_id)')
    .eq('sessions.tutor_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data ?? []).map((row) => ({
    id: row.id,
    tutor_earning_grosz: row.tutor_earning_grosz,
    transfer_pending: row.transfer_pending,
    created_at: row.created_at,
  }))
}
