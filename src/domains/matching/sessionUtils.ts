import type { SessionData } from './types'

/** Supabase zwraca zagnieżdżone relacje jako tablicę lub obiekt zależnie od zapytania. */
export function getSessionData(session: SessionData | SessionData[] | null | undefined): SessionData | null {
  if (!session) return null
  return Array.isArray(session) ? (session[0] ?? null) : session
}