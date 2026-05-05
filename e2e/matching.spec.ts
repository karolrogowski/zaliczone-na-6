import { test, expect, type Page } from '@playwright/test'
import {
  STUDENT_EMAIL,
  TUTOR1_EMAIL,
  TUTOR2_EMAIL,
  INCOMPLETE_TUTOR_EMAIL,
  TEST_PASSWORD,
  adminClient,
} from './global-setup'
import { loginAs, getTestUserIds } from './helpers'

async function getUserIds() {
  const { byEmail } = await getTestUserIds()
  return {
    studentId: byEmail(STUDENT_EMAIL)!,
    tutor1Id: byEmail(TUTOR1_EMAIL)!,
    tutor2Id: byEmail(TUTOR2_EMAIL)!,
    incompleteTutorId: byEmail(INCOMPLETE_TUTOR_EMAIL)!,
  }
}

test.beforeEach(async () => {
  const db = adminClient()
  const ids = await getUserIds()

  await db.from('matching_requests').delete().eq('student_id', ids.studentId)
  await db
    .from('tutor_profiles')
    .update({ is_available: false })
    .in('id', [ids.tutor1Id, ids.tutor2Id])
})

// ════════════════════════════════════════════════════════════════════════════
// Scenariusze z poprzedniej sesji (1–5)
// ════════════════════════════════════════════════════════════════════════════

test('uczeń widzi ekran oczekiwania i odliczanie gdy brak korepetytora', async ({ page }) => {
  await loginAs(page, STUDENT_EMAIL)
  await page.selectOption('select[name="subject_id"]', 'matematyka')
  await page.click('button[type="submit"]')

  await expect(page.getByText('Szukamy korepetytora')).toBeVisible()
  await expect(page.getByText('Anuluj zlecenie')).toBeVisible()
  await expect(page.getByTestId('countdown')).toBeVisible()
})

test('uczeń widzi komunikat o wygaśnięciu gdy czas minął', async ({ page }) => {
  const { studentId } = await getUserIds()
  await adminClient().from('matching_requests').insert({
    student_id: studentId,
    subject_id: 'matematyka',
    status: 'pending',
    expires_at: new Date(Date.now() - 60_000).toISOString(),
  })

  await loginAs(page, STUDENT_EMAIL)
  await expect(page.getByText('Zlecenie wygasło')).toBeVisible()
})

test('korepetytor widzi pustą listę po włączeniu dostępności gdy brak zleceń', async ({ page }) => {
  await loginAs(page, TUTOR1_EMAIL)

  const toggle = page.getByTestId('availability-toggle')
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await toggle.click()

  await expect(page.getByText('Brak zleceń w Twoich przedmiotach')).toBeVisible()
})

test('korepetytor widzi zlecenie ucznia w czasie rzeczywistym', async ({ browser }) => {
  const { tutor1Id } = await getUserIds()
  await adminClient().from('tutor_profiles').update({ is_available: true }).eq('id', tutor1Id)

  const studentCtx = await browser.newContext()
  const tutorCtx = await browser.newContext()
  const studentPage = await studentCtx.newPage()
  const tutorPage = await tutorCtx.newPage()

  await loginAs(tutorPage, TUTOR1_EMAIL)
  await expect(tutorPage.getByText('Brak zleceń w Twoich przedmiotach')).toBeVisible()

  await loginAs(studentPage, STUDENT_EMAIL)
  await studentPage.selectOption('select[name="subject_id"]', 'matematyka')
  await studentPage.click('button[type="submit"]')

  await expect(tutorPage.getByText('Akceptuj zlecenie')).toBeVisible({ timeout: 10_000 })

  await studentCtx.close()
  await tutorCtx.close()
})

test('tylko jeden korepetytor wygrywa wyścig o zlecenie', async ({ browser }) => {
  const { tutor1Id, tutor2Id } = await getUserIds()
  await adminClient()
    .from('tutor_profiles')
    .update({ is_available: true })
    .in('id', [tutor1Id, tutor2Id])

  const studentCtx = await browser.newContext()
  const tutor1Ctx = await browser.newContext()
  const tutor2Ctx = await browser.newContext()
  const studentPage = await studentCtx.newPage()
  const tutor1Page = await tutor1Ctx.newPage()
  const tutor2Page = await tutor2Ctx.newPage()

  await loginAs(tutor1Page, TUTOR1_EMAIL)
  await loginAs(tutor2Page, TUTOR2_EMAIL)

  await loginAs(studentPage, STUDENT_EMAIL)
  await studentPage.selectOption('select[name="subject_id"]', 'matematyka')
  await studentPage.click('button[type="submit"]')

  await expect(tutor1Page.getByText('Akceptuj zlecenie')).toBeVisible({ timeout: 10_000 })
  await expect(tutor2Page.getByText('Akceptuj zlecenie')).toBeVisible({ timeout: 10_000 })

  await Promise.all([
    tutor1Page.getByText('Akceptuj zlecenie').click(),
    tutor2Page.getByText('Akceptuj zlecenie').click(),
  ])

  await Promise.all([tutor1Page.waitForTimeout(3_000), tutor2Page.waitForTimeout(3_000)])

  const tutor1Won = await tutor1Page.getByText('Zaakceptowałeś zlecenie').isVisible()
  const tutor2Won = await tutor2Page.getByText('Zaakceptowałeś zlecenie').isVisible()
  const tutor1Lost = await tutor1Page.getByText('Ktoś inny przyjął to zlecenie').isVisible()
  const tutor2Lost = await tutor2Page.getByText('Ktoś inny przyjął to zlecenie').isVisible()

  expect(tutor1Won || tutor2Won).toBe(true)
  expect(tutor1Won && tutor2Won).toBe(false)
  expect(tutor1Lost || tutor2Lost).toBe(true)

  await studentCtx.close()
  await tutor1Ctx.close()
  await tutor2Ctx.close()
})

// ════════════════════════════════════════════════════════════════════════════
// Nowe scenariusze (6–12)
// ════════════════════════════════════════════════════════════════════════════

// ─── Scenariusz 6 ────────────────────────────────────────────────────────────

test('uczeń anuluje zlecenie i wraca do formularza', async ({ page }) => {
  await loginAs(page, STUDENT_EMAIL)

  await page.selectOption('select[name="subject_id"]', 'matematyka')
  await page.click('button[type="submit"]')
  await expect(page.getByText('Szukamy korepetytora')).toBeVisible()

  await page.getByText('Anuluj zlecenie').click()

  // Po anulowaniu powinien znów widzieć formularz
  await expect(page.getByText('Zamów korepetytora')).toBeVisible({ timeout: 5_000 })
  await expect(page.locator('select[name="subject_id"]')).toBeVisible()
})

// ─── Scenariusz 7 ────────────────────────────────────────────────────────────

test('uczeń widzi w czasie rzeczywistym że korepetytor zaakceptował', async ({ browser }) => {
  const { tutor1Id } = await getUserIds()
  await adminClient().from('tutor_profiles').update({ is_available: true }).eq('id', tutor1Id)

  const studentCtx = await browser.newContext()
  const tutorCtx = await browser.newContext()
  const studentPage = await studentCtx.newPage()
  const tutorPage = await tutorCtx.newPage()

  await loginAs(studentPage, STUDENT_EMAIL)
  await studentPage.selectOption('select[name="subject_id"]', 'matematyka')
  await studentPage.click('button[type="submit"]')
  await expect(studentPage.getByText('Szukamy korepetytora')).toBeVisible()

  await loginAs(tutorPage, TUTOR1_EMAIL)
  await expect(tutorPage.getByText('Akceptuj zlecenie')).toBeVisible({ timeout: 10_000 })
  await tutorPage.getByText('Akceptuj zlecenie').click()

  // Uczeń powinien zobaczyć potwierdzenie bez odświeżania strony
  await expect(studentPage.getByText('Znaleziono korepetytora')).toBeVisible({ timeout: 10_000 })

  await studentCtx.close()
  await tutorCtx.close()
})

// ─── Scenariusz 8 ────────────────────────────────────────────────────────────

test('zalogowany korepetytor nie widzi formularza zlecenia ucznia', async ({ page }) => {
  await loginAs(page, TUTOR1_EMAIL)

  await expect(page.locator('select[name="subject_id"]')).not.toBeVisible()
  await expect(page.getByText('Zamów korepetytora')).not.toBeVisible()
})

// ─── Scenariusz 9 ────────────────────────────────────────────────────────────

test('zalogowany uczeń nie widzi przełącznika dostępności korepetytora', async ({ page }) => {
  await loginAs(page, STUDENT_EMAIL)

  await expect(page.getByTestId('availability-toggle')).not.toBeVisible()
  await expect(page.getByText('Dostępność')).not.toBeVisible()
})

// ─── Scenariusz 10 ───────────────────────────────────────────────────────────

test('próba złożenia zlecenia bez wybranego przedmiotu pokazuje błąd walidacji', async ({
  page,
}) => {
  await loginAs(page, STUDENT_EMAIL)

  // Kliknij submit bez wybierania przedmiotu
  await page.click('button[type="submit"]')

  // Błąd walidacji — strona nie przeładowała się, URL się nie zmienił
  await expect(page.getByText('Wybierz przedmiot')).toBeVisible()
  expect(page.url()).toContain('/dashboard')
})

// ─── Scenariusz 11 ───────────────────────────────────────────────────────────

test('korepetytor bez uzupełnionego profilu widzi prompt z prośbą o uzupełnienie', async ({
  page,
}) => {
  await loginAs(page, INCOMPLETE_TUTOR_EMAIL)

  await expect(page.getByText('Uzupełnij profil')).toBeVisible()
  await expect(page.getByTestId('availability-toggle')).not.toBeVisible()
})

// ─── Scenariusz 12 ───────────────────────────────────────────────────────────

test('zaakceptowane zlecenie nie jest widoczne dla drugiego korepetytora', async ({ browser }) => {
  const { studentId, tutor1Id, tutor2Id } = await getUserIds()

  // Obaj korepetytorzy dostępni
  await adminClient()
    .from('tutor_profiles')
    .update({ is_available: true })
    .in('id', [tutor1Id, tutor2Id])

  // Wstaw zlecenie ucznia
  const { data: request } = await adminClient()
    .from('matching_requests')
    .insert({ student_id: studentId, subject_id: 'matematyka' })
    .select()
    .single()

  // Korepetytor 1 akceptuje bezpośrednio przez bazę (symulacja że był szybszy)
  await adminClient()
    .from('matching_requests')
    .update({ status: 'accepted', tutor_id: tutor1Id })
    .eq('id', request.id)

  // Korepetytor 2 loguje się — nie powinien widzieć zaakceptowanego zlecenia
  const tutor2Ctx = await browser.newContext()
  const tutor2Page = await tutor2Ctx.newPage()
  await loginAs(tutor2Page, TUTOR2_EMAIL)

  await expect(tutor2Page.getByText('Brak zleceń w Twoich przedmiotach')).toBeVisible()
  await expect(tutor2Page.getByText('Akceptuj zlecenie')).not.toBeVisible()

  await tutor2Ctx.close()
})
