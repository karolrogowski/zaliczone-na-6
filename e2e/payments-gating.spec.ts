/**
 * Luka "darmowej sesji" (domknięta 2026-06-12): zlecenie trafia do feedu
 * korepetytorów dopiero po potwierdzonej preautoryzacji (stripe_status =
 * 'authorized'). Wcześniej zlecenie było widoczne od razu po złożeniu —
 * korepetytor mógł przeprowadzić sesję, za którą nikt nie zapłacił.
 */
import { test, expect } from '@playwright/test'
import Stripe from 'stripe'
import { STUDENT_EMAIL, TUTOR1_EMAIL, adminClient } from './global-setup'
import { loginAs, getTestUserIds } from './helpers'

async function getIds() {
  const { byEmail } = await getTestUserIds()
  return { studentId: byEmail(STUDENT_EMAIL)!, tutor1Id: byEmail(TUTOR1_EMAIL)! }
}

test.beforeEach(async () => {
  const db = adminClient()
  const { studentId, tutor1Id } = await getIds()
  const { data: sessions } = await db.from('sessions').select('id').eq('student_id', studentId)
  if (sessions?.length) {
    const sessionIds = sessions.map((s: { id: string }) => s.id)
    await db.from('ratings').delete().in('session_id', sessionIds)
    await db.from('session_financials').delete().in('session_id', sessionIds)
  }
  await db.from('sessions').delete().eq('student_id', studentId)
  await db.from('matching_requests').delete().eq('student_id', studentId)
  await db.from('tutor_profiles').update({ is_available: true }).eq('id', tutor1Id)
})

test('zlecenie bez potwierdzonej płatności nie pojawia się w feedzie korepetytora', async ({ page }) => {
  const { studentId } = await getIds()
  const db = adminClient()

  const { data: request } = await db
    .from('matching_requests')
    .insert({
      student_id: studentId,
      subject_id: 'matematyka',
      status: 'pending',
      stripe_status: 'pending',
    })
    .select('id')
    .single()

  await loginAs(page, TUTOR1_EMAIL)
  await expect(page.getByText('Brak zleceń w Twoich przedmiotach')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('Akceptuj zlecenie')).not.toBeVisible()

  // Po potwierdzeniu blokady środków zlecenie pojawia się w feedzie
  // (realtime/polling — odświeżenie do 10 s)
  await db.from('matching_requests').update({ stripe_status: 'authorized' }).eq('id', request!.id)
  await expect(page.getByText('Akceptuj zlecenie')).toBeVisible({ timeout: 15_000 })
})

test('uczeń z nieopłaconym zleceniem widzi kartę "Dokończ płatność" z linkiem do checkoutu', async ({ page }) => {
  const { studentId } = await getIds()

  const { data: request } = await adminClient()
    .from('matching_requests')
    .insert({
      student_id: studentId,
      subject_id: 'matematyka',
      status: 'pending',
      stripe_status: 'pending',
    })
    .select('id')
    .single()

  await loginAs(page, STUDENT_EMAIL)

  await expect(page.getByText('Dokończ płatność')).toBeVisible()
  await expect(page.getByText('Szukamy korepetytora...')).not.toBeVisible()
  await expect(page.getByRole('link', { name: 'Przejdź do płatności' })).toHaveAttribute(
    'href',
    `/checkout/${request!.id}`
  )
})

test('fallback bez webhooka: wejście ucznia na dashboard synchronizuje status ze Stripe', async ({ page }) => {
  test.skip(!process.env.STRIPE_SECRET_KEY, 'Brak STRIPE_SECRET_KEY — pomiń testy wymagające Stripe API')
  const { studentId } = await getIds()
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

  // Preautoryzacja potwierdzona w Stripe, ale webhook nie dotarł —
  // stripe_status w DB wciąż 'pending'
  const pi = await stripe.paymentIntents.create({
    amount: 10000,
    currency: 'pln',
    capture_method: 'manual',
    payment_method: 'pm_card_visa',
    confirm: true,
    automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
  })

  const { data: request } = await adminClient()
    .from('matching_requests')
    .insert({
      student_id: studentId,
      subject_id: 'matematyka',
      status: 'pending',
      stripe_status: 'pending',
      stripe_payment_intent_id: pi.id,
    })
    .select('id')
    .single()

  await loginAs(page, STUDENT_EMAIL)

  // Lazy sync w getStudentActiveRequest dociągnął status — zlecenie aktywne
  await expect(page.getByText('Szukamy korepetytora...')).toBeVisible({ timeout: 10_000 })

  const { data: updated } = await adminClient()
    .from('matching_requests')
    .select('stripe_status')
    .eq('id', request!.id)
    .single()
  expect(updated?.stripe_status).toBe('authorized')
})
