import type { Page } from '@playwright/test'
import { adminClient, MAILPIT_URL, TEST_PASSWORD } from './global-setup'

export async function loginAs(page: Page, email: string) {
  await page.goto('/login')
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', TEST_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('/dashboard')
}

/** Wypełnia i wysyła formularz zlecenia na /request, czeka na redirect do /dashboard */
export async function submitRequest(page: Page, subject = 'matematyka') {
  await page.goto('/request')
  await page.selectOption('select[name="subject_id"]', subject)
  await page.selectOption('select[name="level"]', 'liceum_1')
  await page.selectOption('select[name="scope"]', 'homework')
  await page.fill('textarea[name="description"]', 'Testowe zlecenie e2e')
  await page.click('button[type="submit"]')
  await page.waitForURL('/dashboard')
}

export async function getTestUserIds() {
  const { data } = await adminClient().auth.admin.listUsers()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const users: any[] = data?.users ?? []
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    byEmail: (email: string) => users.find((u: any) => u.email === email)?.id as string | undefined,
  }
}

/**
 * Pobiera link z emaila wysłanego na dany adres z Mailpit.
 * Oczekuje na email przez max 10 sekund, szuka href zawierającego wzorzec.
 */
export async function getEmailLink(toEmail: string, hrefPattern: string): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const res = await fetch(`${MAILPIT_URL}/api/v1/messages`)
    const data = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const msg = data.messages?.find((m: any) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      m.To?.some((to: any) => to.Address === toEmail)
    )
    if (msg) {
      const msgRes = await fetch(`${MAILPIT_URL}/api/v1/message/${msg.ID}`)
      const msgData = await msgRes.json()
      const html: string = msgData.HTML ?? ''
      const regex = new RegExp(`href="([^"]*${hrefPattern}[^"]*)"`)
      const match = html.match(regex)
      if (match) return match[1].replace(/&amp;/g, '&')
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`Email dla ${toEmail} nie pojawił się w Mailpit w ciągu 10 sekund`)
}

/** Usuwa wszystkie maile z Mailpit — wywołaj przed testem który weryfikuje emaile */
export async function clearMailpit() {
  await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: 'DELETE' })
}

/**
 * Klika gwiazdki we wszystkich 3 wymiarach formularza oceny ucznia.
 * Wszystkie wymiary ustawiane na ten sam `value` (1–5).
 */
export async function selectAllStars(page: Page, value: number) {
  for (const name of ['score_knowledge', 'score_organization', 'score_communication']) {
    await page.locator(`input[name="${name}"][value="${value}"]`).evaluate(
      (el) => (el as HTMLInputElement).click()
    )
  }
}

/**
 * Buduje obiekt oceny ucznia z 3 wymiarami (do bezpośredniego insertu w DB).
 * Wszystkie wymiary ustawiane na `score`.
 */
export function student3DRating(score: number, extra: Record<string, unknown> = {}) {
  return {
    score_knowledge:     score,
    score_organization:  score,
    score_communication: score,
    rated_by: 'student',
    ...extra,
  }
}
