import type { Page } from '@playwright/test'
import { adminClient, MAILPIT_URL, TEST_PASSWORD } from './global-setup'

export async function loginAs(page: Page, email: string) {
  await page.goto('/login')
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', TEST_PASSWORD)
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
