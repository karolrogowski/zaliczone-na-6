'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/shared/supabase/client'
import { subscribeToMatchingRequests } from '@/shared/realtime/adapter'
import type { MatchingRequestWithSubject } from '../types'

async function fetchPendingRequests(): Promise<MatchingRequestWithSubject[]> {
  const supabase = createClient()
  const now = new Date().toISOString()
  const { data } = await supabase
    .from('matching_requests')
    .select('*, subjects(label)')
    .eq('status', 'pending')
    .gt('expires_at', now)
    .order('created_at', { ascending: true })
  return (data ?? []) as MatchingRequestWithSubject[]
}

export function useTutorRequests(initial: MatchingRequestWithSubject[]) {
  const [requests, setRequests] = useState(initial)

  const refetch = useCallback(async () => {
    const fresh = await fetchPendingRequests()
    setRequests(fresh)
  }, [])

  useEffect(() => {
    return subscribeToMatchingRequests({
      channelName: 'tutor-matching-requests',
      onInsert: refetch,
      onUpdate: (updated) => {
        if (updated.status !== 'pending') {
          setRequests((prev) => prev.filter((r) => r.id !== updated.id))
        }
      },
      pollingFn: refetch,
      pollingIntervalMs: 8_000,
    })
  }, [refetch])

  return requests
}