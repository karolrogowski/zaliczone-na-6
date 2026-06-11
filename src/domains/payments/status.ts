import 'server-only'
import { createPaymentsServiceClient } from './service-client'
import type { StripePaymentStatus } from './types'

/**
 * Kolejność statusów płatności — wyższa wartość = dalszy etap. Używana do
 * ochrony przed nadpisaniem stanu starszym/spóźnionym zdarzeniem (np. gdy
 * payment_intent.amount_capturable_updated dotrze po charge.captured).
 */
export const STATUS_RANK: Record<StripePaymentStatus, number> = {
  pending: 0,
  authorized: 1,
  paid: 1,
  failed: 1,
  cancelled: 1,
  captured: 2,
  refunded: 3,
}

export async function updatePaymentStatus(
  paymentIntentId: string,
  newStatus: StripePaymentStatus,
  extra: Record<string, unknown> = {}
): Promise<void> {
  const supabase = createPaymentsServiceClient()

  const { data: current } = await supabase
    .from('matching_requests')
    .select('stripe_status')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .maybeSingle()

  if (!current) return
  if (STATUS_RANK[newStatus] < STATUS_RANK[current.stripe_status as StripePaymentStatus]) return

  await supabase
    .from('matching_requests')
    .update({ stripe_status: newStatus, ...extra })
    .eq('stripe_payment_intent_id', paymentIntentId)
}
