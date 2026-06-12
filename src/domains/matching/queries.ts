import { cache } from 'react'
import { createClient } from '@/shared/supabase/server'
import { cancelExpiredPaymentHolds, syncPaymentStatusFromStripe } from '@/domains/payments/actions'
import type { MatchingRequestWithSubject, Subject, StudentStats, TutorProfileDetails, TutorPublicProfile } from './types'

export const getSubjects = cache(async (): Promise<Subject[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('subjects')
    .select('id, label')
    .eq('is_active', true)
    .order('label')
  return data ?? []
})

export const getStudentActiveRequest = cache(
  async (): Promise<MatchingRequestWithSubject | null> => {
    const supabase = await createClient()
    const select = () =>
      supabase
        .from('matching_requests')
        .select('*, subjects(label), tutor_profile:profiles!tutor_id(full_name), session:sessions(id, daily_room_url)')
        .neq('status', 'cancelled')
        .neq('status', 'expired')
        .neq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    let { data } = await select()

    // Lazy fallback na opóźniony webhook: po powrocie ucznia z checkoutu
    // dociągnij status PaymentIntent ze Stripe, żeby zlecenie nie wisiało
    // jako "oczekuje na płatność" mimo udanej preautoryzacji
    if (data?.status === 'pending' && data.stripe_status === 'pending' && data.stripe_payment_intent_id) {
      await syncPaymentStatusFromStripe(data.id)
      const { data: refreshed } = await select()
      data = refreshed
    }

    return data as MatchingRequestWithSubject | null
  }
)

export const getStudentRecentRequests = cache(
  async (): Promise<MatchingRequestWithSubject[]> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('matching_requests')
      .select('*, subjects(label), tutor_profile:profiles!tutor_id(full_name)')
      .order('created_at', { ascending: false })
      .limit(5)
    return (data ?? []) as MatchingRequestWithSubject[]
  }
)

export const getStudentStats = cache(async (): Promise<StudentStats> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('matching_requests')
    .select('subject_id, tutor_id, subjects(label)')
    .eq('status', 'completed')

  if (!data?.length) return { totalCompleted: 0, subjectsBreakdown: [], uniqueTutors: 0 }

  const totalCompleted = data.length
  const uniqueTutors = new Set(data.filter((r) => r.tutor_id).map((r) => r.tutor_id)).size

  const subjectMap = new Map<string, { label: string; count: number }>()
  for (const req of data) {
    const label = (req.subjects as unknown as { label: string } | null)?.label ?? req.subject_id
    const existing = subjectMap.get(req.subject_id)
    if (existing) existing.count++
    else subjectMap.set(req.subject_id, { label, count: 1 })
  }

  const subjectsBreakdown = [...subjectMap.entries()]
    .map(([subject_id, { label, count }]) => ({ subject_id, label, count }))
    .sort((a, b) => b.count - a.count)

  return { totalCompleted, subjectsBreakdown, uniqueTutors }
})

export const getStudentRecentConsultations = cache(
  async (): Promise<MatchingRequestWithSubject[]> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('matching_requests')
      .select('*, subjects(label), tutor_profile:profiles!tutor_id(full_name), session:sessions(notes)')
      .eq('status', 'completed')
      .order('updated_at', { ascending: false })
      .limit(5)
    return (data ?? []) as MatchingRequestWithSubject[]
  }
)

export const getTutorPendingRequests = cache(
  async (): Promise<MatchingRequestWithSubject[]> => {
    const supabase = await createClient()
    // Lazy expiry: anuluje preautoryzacje płatności i oznacza przeterminowane
    // zlecenia przed pobraniem listy
    await cancelExpiredPaymentHolds()
    await supabase.rpc('expire_pending_requests')

    // Pobierz aktualną preferencję każdego ucznia względem bieżącego korepetytora.
    // RLS filtruje do tutor_id = auth.uid(). Bierzemy NAJNOWSZY wiersz per uczeń
    // (order DESC + deduplikacja w JS), żeby późniejsze want_again nadpisywało avoid
    // z poprzedniej sesji i odwrotnie.
    const { data: prefData } = await supabase
      .from('ratings')
      .select('student_id, preference')
      .eq('rated_by', 'student')
      .order('created_at', { ascending: false })

    const latestByStudent = new Map<string, string | null>()
    for (const row of (prefData ?? [])) {
      if (row.student_id && !latestByStudent.has(row.student_id)) {
        latestByStudent.set(row.student_id, row.preference ?? null)
      }
    }
    const avoidedIds = [...latestByStudent.entries()]
      .filter(([, pref]) => pref === 'avoid')
      .map(([id]) => id)

    const now = new Date().toISOString()
    let query = supabase
      .from('matching_requests')
      .select('*, subjects(label), tutor_profile:profiles!tutor_id(full_name)')
      .eq('status', 'pending')
      // Zlecenie widoczne dopiero po potwierdzonej blokadzie środków — bez
      // tego sesja mogłaby się odbyć bez zabezpieczonej płatności
      .eq('stripe_status', 'authorized')
      .gt('expires_at', now)

    if (avoidedIds.length > 0) {
      query = query.not('student_id', 'in', `(${avoidedIds.join(',')})`)
    }

    const { data } = await query.order('created_at', { ascending: true })
    return (data ?? []) as MatchingRequestWithSubject[]
  }
)

export const getTutorAcceptedRequest = cache(
  async (): Promise<MatchingRequestWithSubject | null> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('matching_requests')
      .select('*, subjects(label), tutor_profile:profiles!tutor_id(full_name), session:sessions(id, daily_room_url)')
      .eq('status', 'accepted')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    return data as MatchingRequestWithSubject | null
  }
)

export const getTutorRecentRequests = cache(
  async (): Promise<MatchingRequestWithSubject[]> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('matching_requests')
      .select('*, subjects(label), tutor_profile:profiles!tutor_id(full_name), session:sessions(notes)')
      .in('status', ['accepted', 'completed'])
      .order('updated_at', { ascending: false })
      .limit(5)
    return (data ?? []) as MatchingRequestWithSubject[]
  }
)

export const getTutorPublicProfile = cache(
  async (id: string): Promise<TutorPublicProfile | null> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('tutor_profiles')
      .select('hourly_rate_grosz, bio, is_available, rating_avg, rating_count, levels, profiles!id(full_name), tutor_subjects(subject_id, subjects(label))')
      .eq('id', id)
      .single()
    return data as TutorPublicProfile | null
  }
)

export const getSessionForRating = cache(
  async (requestId: string): Promise<{
    id: string
    student_id: string
    tutor_id: string
    status: string
    student: { full_name: string } | null
    tutor: { full_name: string } | null
  } | null> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('sessions')
      .select('id, student_id, tutor_id, status, student:profiles!student_id(full_name), tutor:profiles!tutor_id(full_name)')
      .eq('matching_request_id', requestId)
      .maybeSingle()
    return data as {
      id: string
      student_id: string
      tutor_id: string
      status: string
      student: { full_name: string } | null
      tutor: { full_name: string } | null
    } | null
  }
)

export const hasRatingForSession = cache(
  async (sessionId: string, ratedBy: 'student' | 'tutor'): Promise<boolean> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('ratings')
      .select('id')
      .eq('session_id', sessionId)
      .eq('rated_by', ratedBy)
      .maybeSingle()
    return data !== null
  }
)

/**
 * Zwraca matching_request_id sesji z oczekującą oceną (okno 4h).
 * Używane przez stronę /rate do weryfikacji, czy zalogowany użytkownik
 * powinien zobaczyć formularz oceny.
 */
export const getPendingRatingRequestId = cache(
  async (userId: string): Promise<string | null> => {
    const supabase = await createClient()
    const { data } = await supabase.rpc('get_pending_rating', { p_user_id: userId })
    return data ?? null
  }
)

export const getSessionDetail = cache(
  async (requestId: string): Promise<MatchingRequestWithSubject | null> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('matching_requests')
      .select('*, subjects(label), tutor_profile:profiles!tutor_id(full_name), student_profile:profiles!student_id(full_name), session:sessions(id, notes)')
      .eq('id', requestId)
      .maybeSingle()
    return data as MatchingRequestWithSubject | null
  }
)

export const getStudentAllSessions = cache(
  async (): Promise<MatchingRequestWithSubject[]> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('matching_requests')
      .select('*, subjects(label), tutor_profile:profiles!tutor_id(full_name), session:sessions(id, notes)')
      .eq('status', 'completed')
      .order('updated_at', { ascending: false })
    return (data ?? []) as MatchingRequestWithSubject[]
  }
)

export const getTutorAllSessions = cache(
  async (): Promise<MatchingRequestWithSubject[]> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('matching_requests')
      .select('*, subjects(label), tutor_profile:profiles!tutor_id(full_name), student_profile:profiles!student_id(full_name), session:sessions(id, notes)')
      .in('status', ['accepted', 'completed'])
      .order('updated_at', { ascending: false })
    return (data ?? []) as MatchingRequestWithSubject[]
  }
)

export type SessionRating = {
  score_knowledge:    number | null
  score_organization: number | null
  score_communication: number | null
  comment: string | null
  rated_by: 'student' | 'tutor'
  tutor_preference: string | null
}

export function avgScore(r: Pick<SessionRating, 'score_knowledge' | 'score_organization' | 'score_communication'>): number | null {
  if (r.score_knowledge == null || r.score_organization == null || r.score_communication == null) return null
  return Math.round(((r.score_knowledge + r.score_organization + r.score_communication) / 3) * 10) / 10
}

/**
 * Zwraca oceny powiązane z sesją.
 * RLS gwarantuje, że:
 *   - uczeń widzi tylko oceny rated_by = 'student' (swoje oceny korepetytora)
 *   - korepetytor widzi obie strony (rated_by = 'student' i rated_by = 'tutor')
 */
export const getRatingsForSession = cache(
  async (sessionId: string): Promise<SessionRating[]> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('ratings')
      .select('score_knowledge, score_organization, score_communication, comment, rated_by, tutor_preference')
      .eq('session_id', sessionId)
    return (data ?? []) as SessionRating[]
  }
)

/**
 * Zwraca historię interakcji bieżącego korepetytora z podanymi uczniami.
 * Używane do wyświetlania odznak w kartach zleceń na dashboardzie.
 * RLS: korepetytor widzi tylko oceny z własnych sesji.
 */
export const getTutorStudentInteractions = cache(
  async (studentIds: string[]): Promise<Record<string, import('./types').TutorStudentInteraction>> => {
    if (studentIds.length === 0) return {}
    const supabase = await createClient()

    const { data } = await supabase
      .from('ratings')
      .select('student_id, score_knowledge, score_organization, score_communication, rated_by, preference, tutor_preference, comment, created_at')
      .in('student_id', studentIds)
      .order('created_at', { ascending: false })

    const result: Record<string, import('./types').TutorStudentInteraction> = {}

    for (const studentId of studentIds) {
      const rows = (data ?? []).filter((r) => r.student_id === studentId)
      const byStudent = rows.filter((r) => r.rated_by === 'student')
      const byTutor   = rows.filter((r) => r.rated_by === 'tutor')
      const flagRow   = byTutor.find((r) => r.tutor_preference === 'flag')
      const lastStudentRow = byStudent[0]

      const lastAvg = lastStudentRow?.score_knowledge != null
        && lastStudentRow?.score_organization != null
        && lastStudentRow?.score_communication != null
        ? Math.round(((lastStudentRow.score_knowledge + lastStudentRow.score_organization + lastStudentRow.score_communication) / 3) * 10) / 10
        : null

      result[studentId] = {
        studentId,
        wantAgain:          byStudent.some((r) => r.preference === 'want_again'),
        hasPreviousSession: rows.length > 0,
        studentLastScore:   lastAvg,
        tutorFlagged:       flagRow !== undefined,
        tutorNote:          flagRow?.comment ?? null,
      }
    }

    return result
  }
)

/**
 * Zwraca ostatnią ocenę ucznia wystawioną danemu korepetytorowi.
 * Używane na dashboardzie ucznia, gdy korepetytor akceptuje zlecenie.
 */
/**
 * Zwraca listę korepetytorów oznaczonych przez ucznia jako 'avoid'.
 * Deduplikuje: jeśli uczeń miał wiele sesji z tym samym korepetytorem
 * i każdą oznaczył jako avoid, na liście pojawia się raz.
 */
// Pomocnicza funkcja: dla zalogowanego ucznia zwraca listę korepetytorów
// z aktualną preferencją równą `targetPref`. Bierze NAJNOWSZY wiersz per
// korepetytor (order DESC + deduplikacja), żeby zmiana preferencji w nowej
// sesji zastępowała starą.
async function getStudentTutorsByPreference(
  targetPref: 'want_again' | 'avoid'
): Promise<Array<{ tutorId: string; tutorName: string }>> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('ratings')
    .select('tutor_id, preference, tutor:profiles!tutor_id(full_name)')
    .eq('rated_by', 'student')
    .order('created_at', { ascending: false })

  if (!data) return []

  const seen = new Set<string>()
  return data
    .filter((r) => r.tutor_id && !seen.has(r.tutor_id) && seen.add(r.tutor_id))
    .filter((r) => r.preference === targetPref)
    .map((r) => ({
      tutorId: r.tutor_id as string,
      tutorName: (r.tutor as unknown as { full_name: string } | null)?.full_name ?? 'Korepetytor',
    }))
}

export const getStudentFavoriteTutors = cache(
  async (): Promise<Array<{ tutorId: string; tutorName: string }>> =>
    getStudentTutorsByPreference('want_again')
)

export const getStudentAvoidedTutors = cache(
  async (): Promise<Array<{ tutorId: string; tutorName: string }>> =>
    getStudentTutorsByPreference('avoid')
)

export const getStudentPreviousRatingOfTutor = cache(
  async (tutorId: string): Promise<{
    score_knowledge: number | null
    score_organization: number | null
    score_communication: number | null
    preference: string | null
  } | null> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('ratings')
      .select('score_knowledge, score_organization, score_communication, preference')
      .eq('tutor_id', tutorId)
      .eq('rated_by', 'student')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    return data
  }
)

/**
 * Zwraca ocenę ucznia dla sesji jeśli istnieje i nadal jest edytowalna (editable_until > now).
 * Używane przez stronę /rate do renderowania trybu edycji.
 */
export const getEditableRatingForSession = cache(
  async (sessionId: string, ratedBy: 'student' | 'tutor'): Promise<{
    score_knowledge: number
    score_organization: number
    score_communication: number
    comment: string | null
    justification_category: string | null
    preference: string | null
    editable_until: string
  } | null> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('ratings')
      .select('score_knowledge, score_organization, score_communication, comment, justification_category, preference, editable_until')
      .eq('session_id', sessionId)
      .eq('rated_by', ratedBy)
      .gt('editable_until', new Date().toISOString())
      .maybeSingle()
    return data as typeof data
  }
)

export const getTutorProfileDetails = cache(
  async (): Promise<TutorProfileDetails | null> => {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const { data } = await supabase
      .from('tutor_profiles')
      .select('is_available, hourly_rate_grosz, levels, rating_avg, rating_count, tutor_subjects(subject_id)')
      .eq('id', user.id)
      .single()
    return data as TutorProfileDetails | null
  }
)
