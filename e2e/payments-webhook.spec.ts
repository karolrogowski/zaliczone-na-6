/**
 * Krok 1 planu płatności (docs/payment-implementation-plan.md): konfiguracja
 * Stripe i endpoint webhooka — testy 1-2 weryfikują warstwę bezpieczeństwa
 * (weryfikacja podpisu).
 *
 * Krok 5: testy 3-5 weryfikują obsługę zdarzeń statusu płatności —
 * aktualizację `matching_requests.stripe_status` po stronie webhooka.
 */
import { test, expect } from '@playwright/test'
import Stripe from 'stripe'
import { adminClient, STUDENT_EMAIL } from './global-setup'
import { getTestUserIds } from './helpers'

const WEBHOOK_PATH = '/api/webhooks/stripe'

async function postEvent(
  request: import('@playwright/test').APIRequestContext,
  secret: string,
  body: object
) {
  const payload = JSON.stringify(body)
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret })

  return request.post(WEBHOOK_PATH, {
    headers: {
      'stripe-signature': header,
      'content-type': 'application/json',
    },
    data: payload,
  })
}

async function createMatchingRequest(paymentIntentId: string) {
  const db = adminClient()
  const { byEmail } = await getTestUserIds()
  const studentId = byEmail(STUDENT_EMAIL)!

  const { data } = await db
    .from('matching_requests')
    .insert({
      student_id: studentId,
      subject_id: 'matematyka',
      status: 'pending',
      stripe_payment_intent_id: paymentIntentId,
      stripe_status: 'pending',
    })
    .select('id')
    .single()

  return data!.id as string
}

test('webhook odrzuca żądanie bez nagłówka stripe-signature', async ({ request }) => {
  const res = await request.post(WEBHOOK_PATH, {
    data: { type: 'payment_intent.created' },
  })

  expect(res.status()).toBe(400)
})

test('webhook odrzuca żądanie z nieprawidłowym podpisem', async ({ request }) => {
  const res = await request.post(WEBHOOK_PATH, {
    headers: { 'stripe-signature': 't=1,v1=falszywy-podpis' },
    data: { type: 'payment_intent.created' },
  })

  expect(res.status()).toBe(400)
})

test('webhook przyjmuje żądanie z prawidłowym podpisem', async ({ request }) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    test.skip(true, 'Brak STRIPE_WEBHOOK_SECRET — pomiń test wymagający prawdziwego sekretu webhooka')
    return
  }

  const payload = JSON.stringify({
    id: 'evt_test_123',
    type: 'payment_intent.created',
    data: { object: { id: 'pi_test_123' } },
  })

  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret })

  const res = await request.post(WEBHOOK_PATH, {
    headers: {
      'stripe-signature': header,
      'content-type': 'application/json',
    },
    data: payload,
  })

  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.received).toBe(true)
})

test('webhook: payment_intent.amount_capturable_updated ustawia status authorized', async ({ request }) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    test.skip(true, 'Brak STRIPE_WEBHOOK_SECRET — pomiń test wymagający prawdziwego sekretu webhooka')
    return
  }

  const paymentIntentId = `pi_test_authorized_${Date.now()}`
  const requestId = await createMatchingRequest(paymentIntentId)

  const res = await postEvent(request, secret, {
    id: `evt_test_authorized_${Date.now()}`,
    type: 'payment_intent.amount_capturable_updated',
    data: { object: { id: paymentIntentId } },
  })

  expect(res.status()).toBe(200)

  const { data } = await adminClient()
    .from('matching_requests')
    .select('stripe_status')
    .eq('id', requestId)
    .single()

  expect(data!.stripe_status).toBe('authorized')
})

test('webhook: payment_intent.payment_failed ustawia status failed', async ({ request }) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    test.skip(true, 'Brak STRIPE_WEBHOOK_SECRET — pomiń test wymagający prawdziwego sekretu webhooka')
    return
  }

  const paymentIntentId = `pi_test_failed_${Date.now()}`
  const requestId = await createMatchingRequest(paymentIntentId)

  const res = await postEvent(request, secret, {
    id: `evt_test_failed_${Date.now()}`,
    type: 'payment_intent.payment_failed',
    data: { object: { id: paymentIntentId } },
  })

  expect(res.status()).toBe(200)

  const { data } = await adminClient()
    .from('matching_requests')
    .select('stripe_status')
    .eq('id', requestId)
    .single()

  expect(data!.stripe_status).toBe('failed')
})

test('webhook: spóźnione zdarzenie nie cofa statusu po charge.captured (idempotencja)', async ({ request }) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    test.skip(true, 'Brak STRIPE_WEBHOOK_SECRET — pomiń test wymagający prawdziwego sekretu webhooka')
    return
  }

  const paymentIntentId = `pi_test_captured_${Date.now()}`
  const chargeId = `ch_test_${Date.now()}`
  const requestId = await createMatchingRequest(paymentIntentId)

  // Najpierw charge.captured — najdalszy etap przed refundem
  const capturedRes = await postEvent(request, secret, {
    id: `evt_test_captured_${Date.now()}`,
    type: 'charge.captured',
    data: { object: { id: chargeId, payment_intent: paymentIntentId } },
  })
  expect(capturedRes.status()).toBe(200)

  let { data } = await adminClient()
    .from('matching_requests')
    .select('stripe_status, stripe_charge_id')
    .eq('id', requestId)
    .single()

  expect(data!.stripe_status).toBe('captured')
  expect(data!.stripe_charge_id).toBe(chargeId)

  // Spóźnione/duplikowane zdarzenie sprzed capture — nie powinno cofnąć statusu
  const staleRes = await postEvent(request, secret, {
    id: `evt_test_stale_${Date.now()}`,
    type: 'payment_intent.amount_capturable_updated',
    data: { object: { id: paymentIntentId } },
  })
  expect(staleRes.status()).toBe(200)
  ;({ data } = await adminClient()
    .from('matching_requests')
    .select('stripe_status')
    .eq('id', requestId)
    .single())

  expect(data!.stripe_status).toBe('captured')
})
