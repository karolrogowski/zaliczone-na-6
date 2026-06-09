/**
 * Krok 1 planu płatności (docs/payment-implementation-plan.md): konfiguracja
 * Stripe i endpoint webhooka. Te testy weryfikują wyłącznie warstwę bezpieczeństwa
 * (weryfikacja podpisu) — logika biznesowa zdarzeń przyjdzie w kroku 5.
 */
import { test, expect } from '@playwright/test'
import Stripe from 'stripe'

const WEBHOOK_PATH = '/api/webhooks/stripe'

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
