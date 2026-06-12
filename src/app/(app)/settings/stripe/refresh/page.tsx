import { redirect } from 'next/navigation'
import { startConnectOnboarding } from '@/domains/payments/actions'

/**
 * Strona odświeżenia linku onboardingowego Stripe — Stripe kieruje tu,
 * gdy poprzedni link wygasł lub korepetytor przerwał formularz.
 * Generuje nowy link i przekierowuje z powrotem na hostowany onboarding.
 */
export default async function StripeRefreshPage() {
  const result = await startConnectOnboarding()

  if (result.success) redirect(result.url)
  redirect('/settings')
}
