import { cache } from 'react'
import { createClient } from '@/shared/supabase/server'

export type SessionForVideo = {
  id: string
  student_id: string
  tutor_id: string
  matching_request_id: string
  daily_room_url: string
  daily_room_name: string
  status: string
  started_at: string
  duration_minutes: number | null
}

export const getSessionById = cache(
  async (sessionId: string): Promise<SessionForVideo | null> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('sessions')
      .select('id, student_id, tutor_id, matching_request_id, daily_room_url, daily_room_name, status, started_at, duration_minutes')
      .eq('id', sessionId)
      .maybeSingle()
    return data as SessionForVideo | null
  }
)

export const getSessionForRequest = cache(
  async (requestId: string): Promise<{ id: string; daily_room_url: string | null; status: string } | null> => {
    const supabase = await createClient()
    const { data } = await supabase
      .from('sessions')
      .select('id, daily_room_url, status')
      .eq('matching_request_id', requestId)
      .maybeSingle()
    return data
  }
)