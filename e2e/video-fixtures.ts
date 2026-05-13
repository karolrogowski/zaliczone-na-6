/**
 * Testowe dane wideo — jedyne miejsce do zmiany przy przełączaniu providerów w testach.
 * Zsynchronizuj z src/domains/sessions/video-provider.ts gdy zmieniasz providera.
 *
 * Aktywny provider: Whereby Embedded
 */

export function mockRoomUrl(name: string): string {
  return `https://test.whereby.com/${name}`
}

export function mockHostUrl(name: string): string {
  return `https://test.whereby.com/${name}?roomKey=testkey`
}

/** Selektor iframe pokoju wideo — dopasowuje aktualnego providera */
export const videoIframeSelector = 'iframe'

// ─── Daily.co ────────────────────────────────────────────────────────────────
// Żeby przywrócić: zamień implementacje powyżej na:
//
// export const mockRoomUrl = (name: string) => `https://test.daily.co/${name}`
// export const mockHostUrl = (name: string) => `https://test.daily.co/${name}`
// export const videoIframeSelector = 'iframe[src*="daily.co"]'