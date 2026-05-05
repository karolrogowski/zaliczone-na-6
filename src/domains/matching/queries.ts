import { cache } from 'react'
import { createClient } from '@/shared/supabase/server'
import type { MatchingRequestWithSubject, Subject, TutorProfileDetails } from './types'

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
      .select('*, subjects(label)')
      .neq('status', 'cancelled')
      .neq('status', 'expired')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    return data as MatchingRequestWithSubject | null
  }
)

export const getTutorPendingRequests = cache(
  async (): Promise<MatchingRequestWithSubject[]> => {
    const supabase = await createClient()
    const now = new Date().toISOString()
    const { data } = await supabase
      .from('matching_requests')
      .select('*, subjects(label)')
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
      .select('*, subjects(label)')
      .eq('status', 'accepted')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    return data as MatchingRequestWithSubject | null
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
      .select('is_available, hourly_rate_grosz, tutor_subjects(subject_id)')
      .eq('id', user.id)
      .single()
    return data as TutorProfileDetails | null
  }
)
