/**
 * Krok 7 planu płatności (docs/payment-implementation-plan.md): onboarding
 * korepetytora przez Stripe Connect Express.
 *
 * Wymaga włączonego Stripe Connect na platformowym koncie testowym
 * (jednorazowa aktywacja w dashboardzie Stripe). Jeśli Connect nie jest
 * aktywny, testy są pomijane z czytelnym komunikatem.
 *
 * Pełne przejście hostowanego formularza onboardingowego Stripe nie jest
 * automatyzowane (zewnętrzny, zmienny UI) — pozytywną ścieżkę return-page
 * weryfikujemy manualnie w test mode; tu testujemy ścieżkę "konto niekompletne"
 * oraz render UI dla obu stanów flagi stripe_onboarding_done.
 */
import { test, expect } from '@playwright/test'
import Stripe from 'stripe'
import { TUTOR2_EMAIL, adminClient } from './global-setup'
import { loginAs, getTestUserIds } from './helpers'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}

async function getTutor2Id(): Promise<string> {
  const { byEmail } = await getTestUserIds()
  return byEmail(TUTOR2_EMAIL)!
}

/** Przywraca stan wyjściowy pól Stripe na profilu korepetytora. */
async function resetTutorStripeFields(tutorId: string) {
  await adminClient()
    .from('tutor_profiles')
    .update({ stripe_account_id: null, stripe_onboarding_done: false })
    .eq('id', tutorId)
}

let connectEnabled = true

test.beforeAll(async () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    connectEnabled = false
    return
  }
  // Sonda: tworzenie konta Express nie powiedzie się, jeśli platforma nie ma
  // aktywowanego Connect w test mode — wtedy pomijamy cały plik.
  try {
    const probe = await getStripe().accounts.create({
      type: 'express',
      country: 'PL',
      capabilities: { transfers: { requested: true } },
      metadata: { purpose: 'e2e-connect-probe' },
    })
    await getStripe().accounts.del(probe.id)
  } catch {
    connectEnabled = false
  }
})

test.beforeEach(async () => {
  test.skip(
    !connectEnabled,
    'Stripe Connect nieaktywny (brak STRIPE_SECRET_KEY lub Connect niewłączony w dashboardzie)'
  )
  await resetTutorStripeFields(await getTutor2Id())
})

test('korepetytor bez konta Stripe widzi przycisk "Połącz konto bankowe"', async ({ page }) => {
  await loginAs(page, TUTOR2_EMAIL)
  await page.goto('/settings')

  await expect(page.getByRole('heading', { name: 'Konto bankowe' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Połącz konto bankowe' })).toBeVisible()
})

test('kliknięcie przycisku tworzy konto Connect i przekierowuje na Stripe', async ({ page }) => {
  const tutorId = await getTutor2Id()

  await loginAs(page, TUTOR2_EMAIL)
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Połącz konto bankowe' }).click()

  await page.waitForURL(/connect\.stripe\.com/, { timeout: 20_000 })

  const { data } = await adminClient()
    .from('tutor_profiles')
    .select('stripe_account_id, stripe_onboarding_done')
    .eq('id', tutorId)
    .single()

  expect(data?.stripe_account_id).toMatch(/^acct_/)
  expect(data?.stripe_onboarding_done).toBe(false)
})

test('powrót z niekompletnym kontem pokazuje prośbę o dokończenie konfiguracji', async ({ page }) => {
  const tutorId = await getTutor2Id()

  // Świeże konto Express bez przejścia onboardingu — payouts_enabled = false
  const account = await getStripe().accounts.create({
    type: 'express',
    country: 'PL',
    capabilities: { transfers: { requested: true } },
    metadata: { tutor_id: tutorId, purpose: 'e2e' },
  })
  await adminClient()
    .from('tutor_profiles')
    .update({ stripe_account_id: account.id })
    .eq('id', tutorId)

  await loginAs(page, TUTOR2_EMAIL)
  await page.goto('/settings/stripe/return')

  await expect(page.getByText('Stripe wymaga dodatkowych informacji')).toBeVisible()

  const { data } = await adminClient()
    .from('tutor_profiles')
    .select('stripe_onboarding_done')
    .eq('id', tutorId)
    .single()
  expect(data?.stripe_onboarding_done).toBe(false)
})

test('po ukończonym onboardingu ustawienia pokazują "Konto podłączone"', async ({ page }) => {
  const tutorId = await getTutor2Id()

  await adminClient()
    .from('tutor_profiles')
    .update({ stripe_account_id: 'acct_e2e_done', stripe_onboarding_done: true })
    .eq('id', tutorId)

  await loginAs(page, TUTOR2_EMAIL)
  await page.goto('/settings')

  await expect(page.getByText('✓ Konto podłączone')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Otwórz panel wypłat Stripe' })).toBeVisible()

  await resetTutorStripeFields(tutorId)
})

test('korepetytor bez onboardingu widzi ostrzeżenie na dashboardzie', async ({ page }) => {
  await loginAs(page, TUTOR2_EMAIL)

  await expect(
    page.getByText('Podłącz konto bankowe w', { exact: false })
  ).toBeVisible()
})
