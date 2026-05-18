'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/shared/supabase/client'
import { subscribeToMatchingRequest } from '@/shared/realtime/adapter'
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
  const initialId = initial?.id

  const refetch = useCallback(async () => {
    if (!initialId) return
    const fresh = await fetchRequest(initialId)
    if (fresh) setRequest(fresh)
  }, [initialId])

  useEffect(() => {
    if (!initialId) return

    return subscribeToMatchingRequest({
      requestId: initialId,
      onChange: refetch,
      pollingIntervalMs: 5_000,
    })
  }, [initialId, refetch])

  return request
}