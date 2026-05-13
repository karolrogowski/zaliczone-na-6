'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/shared/supabase/client'
import type { MatchingRequestWithSubject } from '../types'

async function fetchRequest(id: string): Promise<MatchingRequestWithSubject | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('matching_requests')
    .select('*, subjects(label), tutor_profile:profiles!tutor_id(full_name), session:sessions(id, daily_room_url)')
    .eq('id', id)
    .maybeSingle()
  return data as MatchingRequestWithSubject | null
}

export function useStudentRequest(initial: MatchingRequestWithSubject | null) {
  const [request, setRequest] = useState(initial)

  const refetch = useCallback(async () => {
    if (!initial?.id) return
    const fresh = await fetchRequest(initial.id)
    if (fresh) setRequest(fresh)
  }, [initial?.id])

  useEffect(() => {
    if (!initial?.id) return

    const supabase = createClient()

    const channel = supabase
      .channel(`student-request-${initial.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matching_requests',
          filter: `id=eq.${initial.id}`,
        },
        () => refetch()
      )
      .subscribe()

    // Fallback polling — odpala co 5 sekund gdy Realtime zawiedzie
    const pollId = setInterval(refetch, 5_000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(pollId)
    }
  }, [initial?.id, refetch])

  return request
}
