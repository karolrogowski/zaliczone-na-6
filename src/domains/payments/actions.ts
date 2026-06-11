'use server'

import { createClient } from '@/shared/supabase/server'
import { getCurrentUserOrNull } from '@/shared/auth/getCurrentUser'
import { getStripeClient } from './stripe-client'
import { createPaymentsServiceClient } from './service-client'
import { updatePaymentStatus } from './status'
import { getSessionPriceGrosz } from './queries'
import type { CreateCheckoutSessionResult, StripePaymentStatus } from './types'

const HOLDABLE_STATUSES: StripePaymentStatus[] = ['pending', 'authorized']

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

/**
 * Pobiera (capture) preautoryzowaną płatność po zakończeniu sesji.
 * Idempotentne — jeśli stripe_status nie jest już 'pending'/'authorized'
 * (np. druga próba po 'captured'), nic nie robi.
 */
export async function capturePayment(requestId: string): Promise<void> {
  const supabase = createPaymentsServiceClient()

  const { data: request } = await supabase
    .from('matching_requests')
    .select('stripe_payment_intent_id, stripe_status')
    .eq('id', requestId)
    .maybeSingle()

  if (!request?.stripe_payment_intent_id) return
  if (!HOLDABLE_STATUSES.includes(request.stripe_status as StripePaymentStatus)) return

  try {
    const paymentIntent = await getStripeClient().paymentIntents.capture(request.stripe_payment_intent_id)
    const chargeId =
      typeof paymentIntent.latest_charge === 'string'
        ? paymentIntent.latest_charge
        : paymentIntent.latest_charge?.id

    await updatePaymentStatus(
      request.stripe_payment_intent_id,
      'captured',
      chargeId ? { stripe_charge_id: chargeId } : {}
    )
  } catch (err) {
    console.error('[payments] Nie udało się pobrać płatności:', err)
  }
}

/**
 * Anuluje preautoryzację (zwalnia zablokowane środki) — gdy uczeń anuluje
 * zlecenie lub gdy zlecenie wygasa bez akceptacji korepetytora.
 */
export async function cancelPaymentHold(requestId: string): Promise<void> {
  const supabase = createPaymentsServiceClient()

  const { data: request } = await supabase
    .from('matching_requests')
    .select('stripe_payment_intent_id, stripe_status')
    .eq('id', requestId)
    .maybeSingle()

  if (!request?.stripe_payment_intent_id) return
  if (!HOLDABLE_STATUSES.includes(request.stripe_status as StripePaymentStatus)) return

  try {
    await getStripeClient().paymentIntents.cancel(request.stripe_payment_intent_id)
    await updatePaymentStatus(request.stripe_payment_intent_id, 'cancelled')
  } catch (err) {
    console.error('[payments] Nie udało się anulować preautoryzacji:', err)
  }
}

/**
 * Anuluje preautoryzacje dla zleceń, które wygasły bez akceptacji
 * korepetytora. Wywoływane jako housekeeping przy lazy expiry
 * (zob. expire_pending_requests w matching/queries.ts).
 */
export async function cancelExpiredPaymentHolds(): Promise<void> {
  const supabase = createPaymentsServiceClient()

  const { data: expired } = await supabase
    .from('matching_requests')
    .select('id')
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString())
    .not('stripe_payment_intent_id', 'is', null)
    .in('stripe_status', HOLDABLE_STATUSES)

  if (!expired?.length) return

  await Promise.all(expired.map((r) => cancelPaymentHold(r.id)))
}
