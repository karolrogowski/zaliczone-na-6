/**
 * Kroki 3 i 4 planu płatności (docs/payment-implementation-plan.md):
 * tworzenie PaymentIntent przy złożeniu zlecenia (krok 3) i formularz płatności
 * Stripe Elements na /checkout/[requestId] (krok 4).
 */
import { test, expect } from '@playwright/test'
import {
  STUDENT_EMAIL,
  RESET_USER_EMAIL,
  adminClient,
} from './global-setup'
import { loginAs, getTestUserIds } from './helpers'

async function getUserIds() {
  const { byEmail } = await getTestUserIds()
  return {
    studentId: byEmail(STUDENT_EMAIL)!,
    otherStudentId: byEmail(RESET_USER_EMAIL)!,
  }
}

test.beforeEach(async () => {
  const db = adminClient()
  const ids = await getUserIds()
  await db.from('matching_requests').delete().eq('student_id', ids.studentId)
  await db.from('matching_requests').delete().eq('student_id', ids.otherStudentId)
})

test('złożenie zlecenia przekierowuje na stronę płatności i tworzy PaymentIntent', async ({ page }) => {
  await loginAs(page, STUDENT_EMAIL)

  await page.goto('/request')
  await page.selectOption('select[name="subject_id"]', 'matematyka')
  await page.selectOption('select[name="level"]', 'liceum_1')
  await page.fill('textarea[name="description"]', 'Testowe zlecenie e2e — płatność')
  await page.getByRole('button', { name: 'Znajdź korepetytora' }).click()

  await page.waitForURL(/\/checkout\/[0-9a-f-]+/, { timeout: 15_000 })

  // Formularz płatności Stripe Elements jest widoczny
  await expect(page.getByText('Płatność za sesję')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Zapłać' })).toBeVisible({ timeout: 15_000 })

  // session_financials/matching_requests: PaymentIntent zapisany ze statusem 'pending'
  const requestId = page.url().split('/checkout/')[1]
  const { data: request } = await adminClient()
    .from('matching_requests')
    .select('stripe_payment_intent_id, stripe_status')
    .eq('id', requestId)
    .single()

  expect(request.stripe_payment_intent_id).toMatch(/^pi_/)
  expect(request.stripe_status).toBe('pending')
})

test('uczeń nie może wejść na checkout cudzego zlecenia', async ({ browser }) => {
  const db = adminClient()
  const ids = await getUserIds()

  const { data: request } = await db
    .from('matching_requests')
    .insert({ student_id: ids.studentId, subject_id: 'matematyka', status: 'pending' })
    .select('id')
    .single()

  // Drugi uczeń próbuje wejść na cudzy checkout
  const otherCtx = await browser.newContext()
  const otherPage = await otherCtx.newPage()
  await loginAs(otherPage, RESET_USER_EMAIL)

  await otherPage.goto(`/checkout/${request!.id}`)
  await otherPage.waitForURL('/dashboard', { timeout: 10_000 })

  await otherCtx.close()
})

test('uczeń płaci testową kartą i trafia na dashboard z potwierdzeniem', async ({ page }) => {
  test.setTimeout(60_000)
  await loginAs(page, STUDENT_EMAIL)

  await page.goto('/request')
  await page.selectOption('select[name="subject_id"]', 'matematyka')
  await page.selectOption('select[name="level"]', 'liceum_1')
  await page.fill('textarea[name="description"]', 'Testowe zlecenie e2e — płatność kartą')
  await page.getByRole('button', { name: 'Znajdź korepetytora' }).click()
  await page.waitForURL(/\/checkout\/[0-9a-f-]+/, { timeout: 15_000 })

  const stripeFrame = page.frameLocator('iframe[title="Secure payment input frame"]').first()
  // Zakładka "Card" pojawia się tylko gdy w koncie Stripe włączonych jest
  // kilka metod płatności; gdy karta jest jedyną opcją, formularz jest widoczny od razu.
  const cardTab = stripeFrame.getByRole('button', { name: /Card/i })
  await cardTab.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {})
  if (await cardTab.isVisible()) {
    await cardTab.click()
  }
  await stripeFrame.locator('input[name="number"]').fill('4242424242424242')
  await stripeFrame.locator('input[name="expiry"]').fill('12/34')
  await stripeFrame.locator('input[name="cvc"]').fill('123')

  // Po wypełnieniu CVC Stripe Link może pokazać podpowiedź nad przyciskiem;
  // odczekanie na jej zniknięcie zapobiega "zgubieniu" kliknięcia "Zapłać".
  const payButton = page.getByRole('button', { name: 'Zapłać' })
  await payButton.scrollIntoViewIfNeeded()
  await page.waitForTimeout(1000)
  await payButton.click()

  await page.waitForURL(/\/dashboard\?payment=success/, { timeout: 30_000 })
  await expect(page.getByText('Płatność zaakceptowana')).toBeVisible()
})

test('uczeń płaci kartą odrzuconą i widzi komunikat błędu', async ({ page }) => {
  test.setTimeout(60_000)
  await loginAs(page, STUDENT_EMAIL)

  await page.goto('/request')
  await page.selectOption('select[name="subject_id"]', 'matematyka')
  await page.selectOption('select[name="level"]', 'liceum_1')
  await page.fill('textarea[name="description"]', 'Testowe zlecenie e2e — karta odrzucona')
  await page.getByRole('button', { name: 'Znajdź korepetytora' }).click()
  await page.waitForURL(/\/checkout\/[0-9a-f-]+/, { timeout: 15_000 })

  const stripeFrame = page.frameLocator('iframe[title="Secure payment input frame"]').first()
  // Zakładka "Card" pojawia się tylko gdy w koncie Stripe włączonych jest
  // kilka metod płatności; gdy karta jest jedyną opcją, formularz jest widoczny od razu.
  const cardTab = stripeFrame.getByRole('button', { name: /Card/i })
  await cardTab.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {})
  if (await cardTab.isVisible()) {
    await cardTab.click()
  }
  await stripeFrame.locator('input[name="number"]').fill('4000000000009995')
  await stripeFrame.locator('input[name="expiry"]').fill('12/34')
  await stripeFrame.locator('input[name="cvc"]').fill('123')

  const payButton = page.getByRole('button', { name: 'Zapłać' })
  await payButton.scrollIntoViewIfNeeded()
  await page.waitForTimeout(1000)
  await payButton.click()

  // Pozostaje na checkout, Stripe Element pokazuje komunikat o odrzuceniu karty
  await expect(stripeFrame.getByText(/insufficient funds|declined/i)).toBeVisible({ timeout: 30_000 })
  expect(page.url()).toContain('/checkout/')
})
