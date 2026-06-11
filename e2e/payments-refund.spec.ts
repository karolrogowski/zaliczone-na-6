/**
 * Krok 10 planu płatności (docs/payment-implementation-plan.md): zwroty (refund).
 *
 * Pełny przepływ "admin klika Zwróć płatność" wymaga zalogowanego administratora
 * z aal2 (TOTP) — w obecnym środowisku testowym nie ma skonfigurowanego konta
 * admina z MFA (zob. komentarz przy teście "updateCommissionPct zapisuje wpis w
 * admin_audit_log" w security.spec.ts), więc tych testów nie da się odtworzyć
 * przez UI. Poniższe testy sprawdzają:
 * - że panel admina (a więc i przycisk zwrotu) jest niedostępny dla zwykłego
 *   użytkownika,
 * - że strona historii sesji ucznia poprawnie wyświetla informację o zwrocie
 *   na podstawie `matching_requests.stripe_status = 'refunded'`.
 */
import { test, expect } from '@playwright/test'
import { STUDENT_EMAIL, TUTOR1_EMAIL, adminClient } from './global-setup'
import { loginAs, getTestUserIds } from './helpers'

async function getUserIds() {
  const { byEmail } = await getTestUserIds()
  return {
    studentId: byEmail(STUDENT_EMAIL)!,
    tutor1Id: byEmail(TUTOR1_EMAIL)!,
  }
}

test.beforeEach(async () => {
  const db = adminClient()
  const ids = await getUserIds()
  await db.from('matching_requests').delete().eq('student_id', ids.studentId)
})

test('uczeń próbujący wejść na panel admina (skąd dostępny jest zwrot płatności) zostaje przekierowany', async ({ page }) => {
  await loginAs(page, STUDENT_EMAIL)
  await page.goto('/admin/sessions')
  await expect(page).toHaveURL('/dashboard')
})

test('uczeń widzi w historii sesji informację o zwrocie płatności', async ({ page }) => {
  const ids = await getUserIds()
  const db = adminClient()

  const { data: request } = await db
    .from('matching_requests')
    .insert({
      student_id: ids.studentId,
      tutor_id: ids.tutor1Id,
      subject_id: 'matematyka',
      status: 'completed',
      stripe_status: 'refunded',
      stripe_payment_intent_id: `pi_test_refund_${Date.now()}`,
      stripe_charge_id: `ch_test_refund_${Date.now()}`,
    })
    .select('id')
    .single()

  await loginAs(page, STUDENT_EMAIL)
  await page.goto(`/history/${request!.id}`)

  await expect(page.getByText('Płatność za tę sesję została zwrócona.')).toBeVisible()
})

test('uczeń nie widzi informacji o zwrocie dla sesji z pobraną (captured) płatnością', async ({ page }) => {
  const ids = await getUserIds()
  const db = adminClient()

  const { data: request } = await db
    .from('matching_requests')
    .insert({
      student_id: ids.studentId,
      tutor_id: ids.tutor1Id,
      subject_id: 'matematyka',
      status: 'completed',
      stripe_status: 'captured',
      stripe_payment_intent_id: `pi_test_captured_${Date.now()}`,
      stripe_charge_id: `ch_test_captured_${Date.now()}`,
    })
    .select('id')
    .single()

  await loginAs(page, STUDENT_EMAIL)
  await page.goto(`/history/${request!.id}`)

  await expect(page.getByText('Płatność za tę sesję została zwrócona.')).not.toBeVisible()
})
