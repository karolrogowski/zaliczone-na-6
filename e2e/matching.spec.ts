import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { STUDENT_EMAIL, TUTOR1_EMAIL, TUTOR2_EMAIL, TEST_PASSWORD } from './global-setup'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function getTestUserIds() {
  const { data } = await adminClient().auth.admin.listUsers()
  const users = data?.users ?? []
  return {
    studentId: users.find((u) => u.email === STUDENT_EMAIL)?.id,
    tutor1Id: users.find((u) => u.email === TUTOR1_EMAIL)?.id,
    tutor2Id: users.find((u) => u.email === TUTOR2_EMAIL)?.id,
  }
}

async function loginAs(page: Page, email: string) {
  await page.goto('/login')
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', TEST_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('/dashboard')
}

test.beforeEach(async () => {
  const db = adminClient()
  const { studentId, tutor1Id, tutor2Id } = await getTestUserIds()

  // Wyczyść zlecenia testowego ucznia
  if (studentId) {
    await db.from('matching_requests').delete().eq('student_id', studentId)
  }

  // Wyłącz dostępność obu korepetytorów
  for (const id of [tutor1Id, tutor2Id]) {
    if (id) await db.from('tutor_profiles').update({ is_available: false }).eq('id', id)
  }
})

// ─── Scenariusz 1 ────────────────────────────────────────────────────────────

test('uczeń widzi ekran oczekiwania i odliczanie gdy brak korepetytora', async ({ page }) => {
  await loginAs(page, STUDENT_EMAIL)

  await page.selectOption('select[name="subject_id"]', 'matematyka')
  await page.click('button[type="submit"]')

  await expect(page.getByText('Szukamy korepetytora')).toBeVisible()
  await expect(page.getByText('Anuluj zlecenie')).toBeVisible()
  await expect(page.getByTestId('countdown')).toBeVisible()
})

// ─── Scenariusz 2 ────────────────────────────────────────────────────────────

test('uczeń widzi komunikat o wygaśnięciu gdy czas minął', async ({ page }) => {
  const { studentId } = await getTestUserIds()

  // Wstaw wygasłe zlecenie bezpośrednio do bazy
  await adminClient()
    .from('matching_requests')
    .insert({
      student_id: studentId,
      subject_id: 'matematyka',
      status: 'pending',
      expires_at: new Date(Date.now() - 60_000).toISOString(), // minuta w przeszłości
    })

  await loginAs(page, STUDENT_EMAIL)
  await expect(page.getByText('Zlecenie wygasło')).toBeVisible()
})

// ─── Scenariusz 3 ────────────────────────────────────────────────────────────

test('korepetytor widzi pustą listę po włączeniu dostępności gdy brak zleceń', async ({
  page,
}) => {
  await loginAs(page, TUTOR1_EMAIL)

  // Korepetytor jest niedostępny — widzi toggle w pozycji "off"
  const toggle = page.getByTestId('availability-toggle')
  await expect(toggle).toHaveAttribute('aria-checked', 'false')

  await toggle.click()

  await expect(page.getByText('Brak zleceń w Twoich przedmiotach')).toBeVisible()
})

// ─── Scenariusz 4 ────────────────────────────────────────────────────────────

test('korepetytor widzi zlecenie ucznia w czasie rzeczywistym', async ({ browser }) => {
  const { tutor1Id } = await getTestUserIds()

  // Korepetytor dostępny przed logowaniem
  await adminClient()
    .from('tutor_profiles')
    .update({ is_available: true })
    .eq('id', tutor1Id)

  const studentCtx = await browser.newContext()
  const tutorCtx = await browser.newContext()

  const studentPage = await studentCtx.newPage()
  const tutorPage = await tutorCtx.newPage()

  await loginAs(tutorPage, TUTOR1_EMAIL)
  await expect(tutorPage.getByText('Brak zleceń w Twoich przedmiotach')).toBeVisible()

  await loginAs(studentPage, STUDENT_EMAIL)
  await studentPage.selectOption('select[name="subject_id"]', 'matematyka')
  await studentPage.click('button[type="submit"]')

  // Korepetytor powinien zobaczyć zlecenie przez Realtime (max 10 sekund)
  await expect(tutorPage.getByText('Akceptuj zlecenie')).toBeVisible({ timeout: 10_000 })

  await studentCtx.close()
  await tutorCtx.close()
})

// ─── Scenariusz 5 ────────────────────────────────────────────────────────────

test('tylko jeden korepetytor wygrywa wyścig o zlecenie', async ({ browser }) => {
  const { tutor1Id, tutor2Id } = await getTestUserIds()

  // Obaj korepetytorzy dostępni
  await adminClient()
    .from('tutor_profiles')
    .update({ is_available: true })
    .in('id', [tutor1Id!, tutor2Id!])

  const studentCtx = await browser.newContext()
  const tutor1Ctx = await browser.newContext()
  const tutor2Ctx = await browser.newContext()

  const studentPage = await studentCtx.newPage()
  const tutor1Page = await tutor1Ctx.newPage()
  const tutor2Page = await tutor2Ctx.newPage()

  // Obaj korepetytorzy logują się i czekają na zlecenia
  await loginAs(tutor1Page, TUTOR1_EMAIL)
  await loginAs(tutor2Page, TUTOR2_EMAIL)

  // Uczeń składa zlecenie
  await loginAs(studentPage, STUDENT_EMAIL)
  await studentPage.selectOption('select[name="subject_id"]', 'matematyka')
  await studentPage.click('button[type="submit"]')

  // Obaj korepetytorzy widzą zlecenie (Realtime)
  await expect(tutor1Page.getByText('Akceptuj zlecenie')).toBeVisible({ timeout: 10_000 })
  await expect(tutor2Page.getByText('Akceptuj zlecenie')).toBeVisible({ timeout: 10_000 })

  // Obaj klikają akceptuj jednocześnie
  await Promise.all([
    tutor1Page.getByText('Akceptuj zlecenie').click(),
    tutor2Page.getByText('Akceptuj zlecenie').click(),
  ])

  // Czekamy na odpowiedź obu
  await Promise.all([
    tutor1Page.waitForTimeout(3_000),
    tutor2Page.waitForTimeout(3_000),
  ])

  const tutor1Won = await tutor1Page.getByText('Zaakceptowałeś zlecenie').isVisible()
  const tutor2Won = await tutor2Page.getByText('Zaakceptowałeś zlecenie').isVisible()
  const tutor1Lost = await tutor1Page.getByText('Ktoś inny przyjął to zlecenie').isVisible()
  const tutor2Lost = await tutor2Page.getByText('Ktoś inny przyjął to zlecenie').isVisible()

  // Dokładnie jeden wygrał
  expect(tutor1Won || tutor2Won).toBe(true)
  expect(tutor1Won && tutor2Won).toBe(false)
  // Przegrany widzi komunikat o błędzie
  expect(tutor1Lost || tutor2Lost).toBe(true)

  await studentCtx.close()
  await tutor1Ctx.close()
  await tutor2Ctx.close()
})
