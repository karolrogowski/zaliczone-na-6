import { createClient } from '@/shared/supabase/server'
import type { TutorStripeState } from './types'

export async function getSessionPriceGrosz(): Promise<number> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('platform_config')
    .select('value')
    .eq('key', 'session_price_grosz')
    .single()

  return data ? parseInt(data.value, 10) : 10000
}

/**
 * Stan konta Stripe Connect zalogowanego korepetytora.
 * RLS pozwala korepetytorowi czytać własny wiersz tutor_profiles.
 */
export async function getOwnTutorStripeState(): Promise<TutorStripeState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { hasAccount: false, onboardingDone: false }

  const { data } = await supabase
    .from('tutor_profiles')
    .select('stripe_account_id, stripe_onboarding_done')
    .eq('id', user.id)
    .maybeSingle()

  return {
    hasAccount: Boolean(data?.stripe_account_id),
    onboardingDone: Boolean(data?.stripe_onboarding_done),
  }
}
