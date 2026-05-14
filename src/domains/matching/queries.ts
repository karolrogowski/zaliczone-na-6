import { cache } from 'react'
import { createClient } from '@/shared/supabase/server'
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
    const { data } = await supabase
      .from('matching_requests')
      .select('*, subjects(label), tutor_profile:profiles!tutor_id(full_name), session:sessions(id, daily_room_url)')
      .neq('status', 'cancelled')
      .neq('status', 'expired')
      .neq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
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
    // Lazy expiry: oznacza przeterminowane zlecenia przed pobraniem listy
    await supabase.rpc('expire_pending_requests')
    const now = new Date().toISOString()
    const { data } = await supabase
      .from('matching_requests')
      .select('*, subjects(label), tutor_profile:profiles!tutor_id(full_name)')
      .eq('status', 'pending')
      .gt('expires_at', now)
      .order('created_at', { ascending: true })
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
  async (requestId: string): Promise<{ id: string; tutor_id: string; status: string } | null> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('sessions')
      .select('id, tutor_id, status')
      .eq('matching_request_id', requestId)
      .maybeSingle()
    return data
  }
)

export const hasRatingForSession = cache(
  async (sessionId: string): Promise<boolean> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('ratings')
      .select('id')
      .eq('session_id', sessionId)
      .maybeSingle()
    return data !== null
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
      .select('is_available, hourly_rate_grosz, levels, tutor_subjects(subject_id)')
      .eq('id', user.id)
      .single()
    return data as TutorProfileDetails | null
  }
)
