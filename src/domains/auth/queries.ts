import { cache } from 'react'
import { createClient } from '@/shared/supabase/server'
import type { Profile } from './types'

export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('id, role, full_name, avatar_url, phone')
    .eq('id', user.id)
    .single()

  return data
})
