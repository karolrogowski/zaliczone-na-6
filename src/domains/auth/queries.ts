import { cache } from 'react'
import { createClient } from '@/shared/supabase/server'
import type { Profile, TutorOwnProfile } from './types'

export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('id, role, full_name, avatar_url')
    .eq('id', user.id)
    .single()

  return data
})

export const getTutorOwnProfile = cache(async (): Promise<TutorOwnProfile | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('tutor_profiles')
    .select('hourly_rate_grosz, bio, levels, tutor_subjects(subject_id)')
    .eq('id', user.id)
    .single()
  return data as TutorOwnProfile | null
})
