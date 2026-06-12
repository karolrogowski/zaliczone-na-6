/**
 * Krok 6 planu płatności (docs/payment-implementation-plan.md): capture/cancel
 * preautoryzacji.
 *
 * Testy tworzą PaymentIntent bezpośrednio przez Stripe API (capture_method:
 * 'manual', confirm: true z testową metodą płatności pm_card_visa) — pomija
 * to formularz Stripe Elements i daje PaymentIntent w stanie 'requires_capture'
 * (odpowiednik stripe_status='authorized'), tak jak po preautoryzacji w
 * /checkout/[requestId].
 */
import { test, expect } from '@playwright/test'
import Stripe from 'stripe'
import { STUDENT_EMAIL, TUTOR1_EMAIL, adminClient } from './global-setup'
import { loginAs, getTestUserIds } from './helpers'

async function getUserIds() {
  const { byEmail } = await getTestUserIds()
  return {
    studentId: byEmail(STUDENT_EMAIL)!,
    tutor1Id: byEmail(TUTOR1_EMAIL)!,
  }
}

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}

/** Tworzy PaymentIntent z preautoryzacją (status 'requires_capture'). */
async function createAuthorizedPaymentIntent(stripe: Stripe, amount = 10000) {
  return stripe.paymentIntents.create({
    amount,
    currency: 'pln',
    capture_method: 'manual',
    payment_method: 'pm_card_visa',
    confirm: true,
    automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
  })
}

async function pollMatchingRequest(requestId: string, predicate: (row: { status: string; stripe_status: string }) => boolean) {
  const db = adminClient()
  for (let i = 0; i < 20; i++) {
    const { data } = await db
      .from('matching_requests')
      .select('status, stripe_status')
      .eq('id', requestId)
      .single()
    if (data && predicate(data)) return data
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`matching_request ${requestId} nie osiągnął oczekiwanego stanu w czasie`)
}

test.beforeEach(async () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    test.skip(true, 'Brak STRIPE_SECRET_KEY — pomiń testy wymagające Stripe API')
    return
  }
  const db = adminClient()
  const ids = await getUserIds()
  // Od kroku 8 zakończona sesja tworzy wiersz w session_financials (FK do
  // sessions) — musi zniknąć przed usunięciem sesji
  const { data: sessions } = await db.from('sessions').select('id').eq('student_id', ids.studentId)
  if (sessions?.length) {
    const sessionIds = sessions.map((s: { id: string }) => s.id)
    await db.from('ratings').delete().in('session_id', sessionIds)
    await db.from('session_financials').delete().in('session_id', sessionIds)
  }
  await db.from('sessions').delete().eq('student_id', ids.studentId)
  await db.from('matching_requests').delete().eq('student_id', ids.studentId)
})

test('anulowanie zlecenia zwalnia preautoryzację (cancelPaymentHold)', async ({ page }) => {
  const stripe = getStripe()
  const ids = await getUserIds()
  const db = adminClient()

  const pi = await createAuthorizedPaymentIntent(stripe)

  const { data: request } = await db
    .from('matching_requests')
    .insert({
      student_id: ids.studentId,
      subject_id: 'matematyka',
      status: 'pending',
      stripe_payment_intent_id: pi.id,
      stripe_status: 'authorized',
    })
    .select('id')
    .single()

  await loginAs(page, STUDENT_EMAIL)
  await page.goto('/dashboard')
  await page.getByRole('button', { name: 'Anuluj zlecenie' }).click()

  // cancelPaymentHold jest wywoływane jako fire-and-forget (void) — odczekaj
  // aż wywołanie Stripe API (cancel) zaktualizuje stripe_status w tle.
  const updated = await pollMatchingRequest(request!.id, (r) => r.status === 'cancelled' && r.stripe_status === 'cancelled')
  expect(updated.stripe_status).toBe('cancelled')

  const updatedPi = await stripe.paymentIntents.retrieve(pi.id)
  expect(updatedPi.status).toBe('canceled')
})

test('zakończenie sesji pobiera preautoryzowaną płatność (capturePayment)', async ({ browser }) => {
  test.setTimeout(60_000)
  const stripe = getStripe()
  const ids = await getUserIds()
  const db = adminClient()

  const pi = await createAuthorizedPaymentIntent(stripe)

  const { data: request } = await db
    .from('matching_requests')
    .insert({
      student_id: ids.studentId,
      subject_id: 'matematyka',
      status: 'accepted',
      tutor_id: ids.tutor1Id,
      stripe_payment_intent_id: pi.id,
      stripe_status: 'authorized',
    })
    .select('id')
    .single()

  const roomName = `test-room-${Date.now()}`
  const { data: session } = await db
    .from('sessions')
    .insert({
      matching_request_id: request!.id,
      student_id: ids.studentId,
      tutor_id: ids.tutor1Id,
      status: 'in_progress',
      started_at: new Date().toISOString(),
      daily_room_name: roomName,
      daily_room_url: `https://test.whereby.com/${roomName}`,
      host_room_url: `https://test.whereby.com/${roomName}?roomKey=testkey`,
    })
    .select('id')
    .single()

  const tutorCtx = await browser.newContext()
  const tutorPage = await tutorCtx.newPage()
  await loginAs(tutorPage, TUTOR1_EMAIL)

  await tutorPage.goto(`/session/${session!.id}`)
  await expect(tutorPage.getByRole('button', { name: 'Zakończ sesję' })).toBeVisible({ timeout: 10_000 })
  await tutorPage.getByRole('button', { name: 'Zakończ sesję' }).click()
  await tutorPage.getByRole('button', { name: 'Tak, zakończ' }).click()
  await tutorPage.waitForURL(/\/rate\/|\/dashboard/, { timeout: 15_000 })

  const updated = await pollMatchingRequest(request!.id, (r) => r.stripe_status === 'captured')
  expect(updated.status).toBe('completed')

  const { data: requestRow } = await db
    .from('matching_requests')
    .select('stripe_charge_id')
    .eq('id', request!.id)
    .single()
  expect(requestRow?.stripe_charge_id).toMatch(/^ch_/)

  const updatedPi = await stripe.paymentIntents.retrieve(pi.id)
  expect(updatedPi.status).toBe('succeeded')

  await tutorCtx.close()
})

test('wygasłe zlecenie bez akceptacji zwalnia preautoryzację (cancelExpiredPaymentHolds)', async ({ page }) => {
  const stripe = getStripe()
  const ids = await getUserIds()
  const db = adminClient()

  const pi = await createAuthorizedPaymentIntent(stripe)

  const { data: request } = await db
    .from('matching_requests')
    .insert({
      student_id: ids.studentId,
      subject_id: 'matematyka',
      status: 'pending',
      stripe_payment_intent_id: pi.id,
      stripe_status: 'authorized',
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    })
    .select('id')
    .single()

  // getTutorPendingRequests (wywoływane na dashboardzie korepetytora) uruchamia
  // lazy expiry: cancelExpiredPaymentHolds + expire_pending_requests
  await loginAs(page, TUTOR1_EMAIL)
  await page.goto('/dashboard')

  const updated = await pollMatchingRequest(request!.id, (r) => r.status === 'expired')
  expect(updated.stripe_status).toBe('cancelled')

  const updatedPi = await stripe.paymentIntents.retrieve(pi.id)
  expect(updatedPi.status).toBe('canceled')
})
