'use server'

import { createClient } from '@/shared/supabase/server'
import { getCurrentUserOrNull } from '@/shared/auth/getCurrentUser'
import { getStripeClient } from './stripe-client'
import { getSessionPriceGrosz } from './queries'
import type { CreateCheckoutSessionResult } from './types'

/**
 * Tworzy preautoryzację płatności (PaymentIntent z capture_method: 'manual')
 * dla zlecenia ucznia. Środki zostaną zablokowane na karcie, a faktyczne
 * pobranie nastąpi po zakończeniu sesji (krok 6 planu płatności).
 */
export async function createCheckoutSession(requestId: string): Promise<CreateCheckoutSessionResult> {
  const user = await getCurrentUserOrNull()
  if (!user) return { success: false, message: 'Nie jesteś zalogowany.' }

  const supabase = await createClient()

  const { data: request } = await supabase
    .from('matching_requests')
    .select('id, student_id, status, stripe_payment_intent_id')
    .eq('id', requestId)
    .maybeSingle()

  if (!request || request.student_id !== user.id) {
    return { success: false, message: 'Brak uprawnień do tego zlecenia.' }
  }

  const stripe = getStripeClient()

  try {
    if (request.stripe_payment_intent_id) {
      const existing = await stripe.paymentIntents.retrieve(request.stripe_payment_intent_id)
      if (existing.client_secret) {
        return { success: true, clientSecret: existing.client_secret }
      }
    }

    const amount = await getSessionPriceGrosz()

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'pln',
      capture_method: 'manual',
      metadata: { matching_request_id: requestId },
    })

    if (!paymentIntent.client_secret) {
      return { success: false, message: 'Nie udało się zainicjować płatności.' }
    }

    await supabase
      .from('matching_requests')
      .update({
        stripe_payment_intent_id: paymentIntent.id,
        stripe_status: 'pending',
      })
      .eq('id', requestId)

    return { success: true, clientSecret: paymentIntent.client_secret }
  } catch (err) {
    console.error('[payments] Nie udało się utworzyć PaymentIntent:', err)
    return { success: false, message: 'Nie udało się zainicjować płatności. Spróbuj ponownie.' }
  }
}
