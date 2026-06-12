/**
 * Krok 9 planu płatności (docs/payment-implementation-plan.md): saldo
 * i wypłata korepetytora.
 *
 * Saldo konta Connect zasilane jest transferem przez Stripe API (platforma
 * finansowana testową kartą pm_card_bypassPending, która od razu zwiększa
 * available balance). Wypłaty w test mode tworzą obiekt payout bez realnego
 * przelewu. Testy pomijane gdy Connect nieaktywny (jak payments-connect).
 */
import { test, expect } from '@playwright/test'
import Stripe from 'stripe'
import { TUTOR2_EMAIL, adminClient } from './global-setup'
import {
  loginAs,
  getTestUserIds,
  isStripeConnectEnabled,
  createActivatedConnectAccount,
} from './helpers'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}

async function getTutor2Id(): Promise<string> {
  const { byEmail } = await getTestUserIds()
  return byEmail(TUTOR2_EMAIL)!
}

async function setTutorAccount(tutorId: string, accountId: string | null, done: boolean) {
  await adminClient()
    .from('tutor_profiles')
    .update({ stripe_account_id: accountId, stripe_onboarding_done: done })
    .eq('id', tutorId)
}

/** Zasila available balance platformy i przelewa kwotę na konto Connect. */
async function fundConnectAccount(stripe: Stripe, accountId: string, amountGrosz: number) {
  await stripe.paymentIntents.create({
    amount: Math.max(amountGrosz * 2, 20000),
    currency: 'pln',
    payment_method: 'pm_card_bypassPending',
    confirm: true,
    automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
  })
  await stripe.transfers.create({
    amount: amountGrosz,
    currency: 'pln',
    destination: accountId,
    metadata: { purpose: 'e2e-payout' },
  })
}

let connectEnabled = true

test.beforeAll(async () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    connectEnabled = false
    return
  }
  connectEnabled = await isStripeConnectEnabled(getStripe())
})

test.beforeEach(async () => {
  test.skip(
    !connectEnabled,
    'Stripe Connect nieaktywny (brak STRIPE_SECRET_KEY lub Connect niewłączony w dashboardzie)'
  )
})

test.afterEach(async () => {
  if (connectEnabled) await setTutorAccount(await getTutor2Id(), null, false)
})

test('korepetytor po onboardingu widzi sekcję Zarobki z saldem', async ({ page }) => {
  test.setTimeout(90_000)
  const accountId = await createActivatedConnectAccount(getStripe())
  await setTutorAccount(await getTutor2Id(), accountId, true)

  await loginAs(page, TUTOR2_EMAIL)
  await page.goto('/settings')

  await expect(page.getByRole('heading', { name: 'Zarobki' })).toBeVisible()
  await expect(page.getByTestId('available-balance')).toBeVisible()
  await expect(page.getByTestId('pending-balance')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Wypłać na konto bankowe' })).toBeVisible()
})

test('saldo po transferze > 0, wypłata tworzy payout w Stripe', async ({ page }) => {
  test.setTimeout(120_000)
  const stripe = getStripe()
  const accountId = await createActivatedConnectAccount(stripe)
  await setTutorAccount(await getTutor2Id(), accountId, true)

  await fundConnectAccount(stripe, accountId, 7000)

  await loginAs(page, TUTOR2_EMAIL)
  await page.goto('/settings')

  await expect(page.getByTestId('available-balance')).toHaveText(/70\.00 zł/, { timeout: 20_000 })

  await page.getByRole('button', { name: 'Wypłać na konto bankowe' }).click()
  await expect(page.getByText('Wypłata 70.00 zł została zlecona')).toBeVisible({ timeout: 20_000 })

  const payouts = await stripe.payouts.list({ limit: 1 }, { stripeAccount: accountId })
  expect(payouts.data[0]?.amount).toBe(7000)
  expect(payouts.data[0]?.currency).toBe('pln')
})

test('przycisk wypłaty nieaktywny przy zerowym saldzie', async ({ page }) => {
  test.setTimeout(90_000)
  const accountId = await createActivatedConnectAccount(getStripe())
  await setTutorAccount(await getTutor2Id(), accountId, true)

  await loginAs(page, TUTOR2_EMAIL)
  await page.goto('/settings')

  await expect(page.getByTestId('available-balance')).toHaveText(/0\.00 zł/)
  await expect(page.getByRole('button', { name: 'Wypłać na konto bankowe' })).toBeDisabled()
})

test('korepetytor bez onboardingu nie widzi sekcji Zarobki', async ({ page }) => {
  await setTutorAccount(await getTutor2Id(), null, false)

  await loginAs(page, TUTOR2_EMAIL)
  await page.goto('/settings')

  await expect(page.getByRole('heading', { name: 'Konto bankowe' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Zarobki' })).not.toBeVisible()
})
