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

// Pobiera URL hosta — wartość zwracana wyłącznie korepetytorowi przypisanemu do sesji.
// Implementacja po stronie bazy: SECURITY DEFINER RPC filtruje po auth.uid() = tutor_id.
export const getSessionHostRoomUrl = cache(
  async (sessionId: string): Promise<string | null> => {
    const supabase = await createClient()
    const { data } = await supabase.rpc('get_session_host_room_url', { p_session_id: sessionId })
    return (data as string | null) ?? null
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