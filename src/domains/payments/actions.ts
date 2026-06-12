'use server'

import { headers } from 'next/headers'
import { createClient } from '@/shared/supabase/server'
import { getCurrentUserOrNull } from '@/shared/auth/getCurrentUser'
import { getStripeClient } from './stripe-client'
import { createPaymentsServiceClient } from './service-client'
import { updatePaymentStatus } from './status'
import { getSessionPriceGrosz } from './queries'
import type {
  ConnectOnboardingState,
  CreateCheckoutSessionResult,
  RequestPayoutResult,
  StartConnectOnboardingResult,
  StripePaymentStatus,
} from './types'

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

    // Krok 8: podział 70/30 i ewidencja finansowa. Błąd na tym etapie nie może
    // cofnąć udanego capture — funkcja loguje i zostawia spójny stan
    // (transfer_pending) do późniejszego nadrobienia.
    await recordFinancialsAndTransfer(
      requestId,
      request.stripe_payment_intent_id,
      paymentIntent.amount_received || paymentIntent.amount,
      chargeId
    )
  } catch (err) {
    console.error('[payments] Nie udało się pobrać płatności:', err)
  }
}

/** Prowizja platformy w procentach (0–100) z platform_config; domyślnie 30. */
async function getCommissionPct(
  supabase: ReturnType<typeof createPaymentsServiceClient>
): Promise<number> {
  const { data } = await supabase
    .from('platform_config')
    .select('value')
    .eq('key', 'commission_pct')
    .single()

  const pct = data ? parseInt(data.value, 10) : 30
  return Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 30
}

/**
 * Po udanym capture: wylicza podział uczeń/korepetytor/platforma, wysyła
 * transfer 70% na konto Connect korepetytora i zapisuje ewidencję do
 * session_financials. Gdy korepetytor nie ukończył onboardingu (albo transfer
 * się nie powiódł), udział jest odkładany flagą transfer_pending i wysyłany
 * po podłączeniu konta (flushPendingTransfers).
 */
async function recordFinancialsAndTransfer(
  requestId: string,
  paymentIntentId: string,
  amountGrosz: number,
  chargeId: string | undefined
): Promise<void> {
  const supabase = createPaymentsServiceClient()

  try {
    const { data: session } = await supabase
      .from('sessions')
      .select('id, tutor_id')
      .eq('matching_request_id', requestId)
      .maybeSingle()
    if (!session) return

    // Idempotencja — unique(session_id); druga próba capture nic nie dopisuje
    const { data: existing } = await supabase
      .from('session_financials')
      .select('id')
      .eq('session_id', session.id)
      .maybeSingle()
    if (existing) return

    const pct = await getCommissionPct(supabase)
    const tutorEarningGrosz = Math.floor((amountGrosz * (100 - pct)) / 100)
    const commissionGrosz = amountGrosz - tutorEarningGrosz

    const { data: tutorProfile } = await supabase
      .from('tutor_profiles')
      .select('stripe_account_id, stripe_onboarding_done')
      .eq('id', session.tutor_id)
      .maybeSingle()

    let transferId: string | null = null
    let transferPending = tutorEarningGrosz > 0

    if (
      transferPending &&
      chargeId &&
      tutorProfile?.stripe_account_id &&
      tutorProfile.stripe_onboarding_done
    ) {
      try {
        const transfer = await getStripeClient().transfers.create({
          amount: tutorEarningGrosz,
          currency: 'pln',
          destination: tutorProfile.stripe_account_id,
          // Wiąże transfer z konkretną płatnością — środki pochodzą z tego
          // charge'a, a nie z ogólnego salda platformy
          source_transaction: chargeId,
          metadata: { matching_request_id: requestId, session_id: session.id },
        })
        transferId = transfer.id
        transferPending = false
      } catch (err) {
        console.error('[payments] Transfer do korepetytora nie powiódł się (odłożony):', err)
      }
    }

    await supabase.from('session_financials').insert({
      session_id: session.id,
      student_cost_grosz: amountGrosz,
      tutor_earning_grosz: tutorEarningGrosz,
      platform_commission_grosz: commissionGrosz,
      stripe_payment_intent_id: paymentIntentId,
      stripe_charge_id: chargeId ?? null,
      stripe_status: 'captured',
      stripe_transfer_id: transferId,
      transfer_pending: transferPending,
    })
  } catch (err) {
    console.error('[payments] Nie udało się zapisać ewidencji finansowej:', err)
  }
}

/**
 * Wysyła odłożone transfery (transfer_pending) korepetytora — wywoływane po
 * pomyślnym ukończeniu onboardingu Stripe Connect.
 */
async function flushPendingTransfers(tutorId: string): Promise<void> {
  const supabase = createPaymentsServiceClient()

  const { data: tutorProfile } = await supabase
    .from('tutor_profiles')
    .select('stripe_account_id')
    .eq('id', tutorId)
    .maybeSingle()
  if (!tutorProfile?.stripe_account_id) return

  const { data: pending } = await supabase
    .from('session_financials')
    .select('id, tutor_earning_grosz, stripe_charge_id, sessions!inner(tutor_id)')
    .eq('transfer_pending', true)
    .eq('sessions.tutor_id', tutorId)

  for (const row of pending ?? []) {
    if (!row.stripe_charge_id || row.tutor_earning_grosz <= 0) continue
    try {
      const transfer = await getStripeClient().transfers.create({
        amount: row.tutor_earning_grosz,
        currency: 'pln',
        destination: tutorProfile.stripe_account_id,
        source_transaction: row.stripe_charge_id,
        metadata: { session_financials_id: row.id },
      })
      await supabase
        .from('session_financials')
        .update({ stripe_transfer_id: transfer.id, transfer_pending: false })
        .eq('id', row.id)
    } catch (err) {
      console.error('[payments] Nie udało się wysłać odłożonego transferu:', err)
    }
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

/**
 * Origin aplikacji do budowania URL-i powrotnych Stripe Connect.
 * NEXT_PUBLIC_SITE_URL ma pierwszeństwo (prod za proxy), fallback na nagłówki.
 */
async function getSiteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL
  if (configured) return configured.replace(/\/$/, '')

  const headerList = await headers()
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host') ?? 'localhost:3000'
  const proto = headerList.get('x-forwarded-proto') ?? 'http'
  return `${proto}://${host}`
}

/** Zwraca id konta Connect korepetytora albo null. Tylko dla roli tutor. */
async function getOwnConnectAccountId(userId: string): Promise<{ accountId: string | null; isTutor: boolean }> {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()
  if (profile?.role !== 'tutor') return { accountId: null, isTutor: false }

  const { data } = await supabase
    .from('tutor_profiles')
    .select('stripe_account_id')
    .eq('id', userId)
    .maybeSingle()

  return { accountId: data?.stripe_account_id ?? null, isTutor: true }
}

/**
 * Rozpoczyna (lub wznawia) onboarding Stripe Connect Express korepetytora.
 * Tworzy konto Express przy pierwszym wywołaniu i zwraca URL hostowanego
 * formularza onboardingowego Stripe, na który klient ma przekierować.
 */
export async function startConnectOnboarding(): Promise<StartConnectOnboardingResult> {
  const user = await getCurrentUserOrNull()
  if (!user) return { success: false, message: 'Nie jesteś zalogowany.' }

  const { accountId: existingAccountId, isTutor } = await getOwnConnectAccountId(user.id)
  if (!isTutor) return { success: false, message: 'Brak uprawnień.' }

  const stripe = getStripeClient()

  try {
    let accountId = existingAccountId

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'PL',
        email: user.email ?? undefined,
        capabilities: { transfers: { requested: true } },
        // Wypłaty ręczne — korepetytor sam zleca przelew z salda (krok 9);
        // domyślny automatyczny harmonogram blokowałby payouts.create
        settings: { payouts: { schedule: { interval: 'manual' } } },
        metadata: { tutor_id: user.id },
      })
      accountId = account.id

      // Zapis przez service role — stripe_account_id jest poza column-level
      // GRANT dla authenticated (ochrona przed mass assignment).
      await createPaymentsServiceClient()
        .from('tutor_profiles')
        .update({ stripe_account_id: accountId })
        .eq('id', user.id)
    }

    const origin = await getSiteOrigin()
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/settings/stripe/refresh`,
      return_url: `${origin}/settings/stripe/return`,
      type: 'account_onboarding',
    })

    return { success: true, url: link.url }
  } catch (err) {
    console.error('[payments] Nie udało się rozpocząć onboardingu Connect:', err)
    return { success: false, message: 'Nie udało się połączyć ze Stripe. Spróbuj ponownie.' }
  }
}

/**
 * Synchronizuje status onboardingu z kontem Stripe — wywoływane po powrocie
 * korepetytora z hostowanego formularza Stripe (/settings/stripe/return).
 * Gdy konto jest gotowe do wypłat, zapisuje stripe_onboarding_done = true.
 */
export async function syncConnectOnboardingStatus(): Promise<ConnectOnboardingState> {
  const user = await getCurrentUserOrNull()
  if (!user) return { connected: false }

  const { accountId } = await getOwnConnectAccountId(user.id)
  if (!accountId) return { connected: false }

  try {
    const account = await getStripeClient().accounts.retrieve(accountId)
    const onboardingDone = Boolean(account.details_submitted && account.payouts_enabled)

    if (onboardingDone) {
      await createPaymentsServiceClient()
        .from('tutor_profiles')
        .update({ stripe_onboarding_done: true })
        .eq('id', user.id)

      // Krok 8: wyślij udziały odłożone z sesji ukończonych przed onboardingiem
      await flushPendingTransfers(user.id)
    }

    return { connected: true, onboardingDone }
  } catch (err) {
    console.error('[payments] Nie udało się pobrać statusu konta Connect:', err)
    return { connected: true, onboardingDone: false }
  }
}

/**
 * Wypłata całego dostępnego salda na konto bankowe korepetytora.
 * Konta Connect mają ręczny harmonogram wypłat — korepetytor sam decyduje
 * kiedy przelać zgromadzone środki (krok 9).
 */
export async function requestPayout(): Promise<RequestPayoutResult> {
  const user = await getCurrentUserOrNull()
  if (!user) return { success: false, message: 'Nie jesteś zalogowany.' }

  const { accountId, isTutor } = await getOwnConnectAccountId(user.id)
  if (!isTutor || !accountId) return { success: false, message: 'Brak połączonego konta Stripe.' }

  const stripe = getStripeClient()

  try {
    const balance = await stripe.balance.retrieve({}, { stripeAccount: accountId })
    const availableGrosz = balance.available
      .filter((p) => p.currency === 'pln')
      .reduce((sum, p) => sum + p.amount, 0)

    if (availableGrosz <= 0) {
      return { success: false, message: 'Brak dostępnych środków do wypłaty.' }
    }

    await stripe.payouts.create(
      { amount: availableGrosz, currency: 'pln' },
      { stripeAccount: accountId }
    )

    return { success: true, amountGrosz: availableGrosz }
  } catch (err) {
    console.error('[payments] Nie udało się zlecić wypłaty:', err)
    return { success: false, message: 'Nie udało się zlecić wypłaty. Spróbuj ponownie.' }
  }
}

/**
 * Link logowania do panelu Stripe Express (historia wypłat korepetytora).
 * Dostępny tylko po ukończonym onboardingu.
 */
export async function getExpressDashboardLink(): Promise<StartConnectOnboardingResult> {
  const user = await getCurrentUserOrNull()
  if (!user) return { success: false, message: 'Nie jesteś zalogowany.' }

  const { accountId } = await getOwnConnectAccountId(user.id)
  if (!accountId) return { success: false, message: 'Brak połączonego konta Stripe.' }

  try {
    const link = await getStripeClient().accounts.createLoginLink(accountId)
    return { success: true, url: link.url }
  } catch (err) {
    console.error('[payments] Nie udało się utworzyć linku do panelu Express:', err)
    return { success: false, message: 'Nie udało się otworzyć panelu Stripe. Spróbuj ponownie.' }
  }
}
