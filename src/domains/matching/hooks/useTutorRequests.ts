'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/shared/supabase/client'
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
    const supabase = createClient()

    const channel = supabase
      .channel('tutor-matching-requests')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'matching_requests' },
        () => refetch()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matching_requests' },
        (payload) => {
          const updated = payload.new as MatchingRequestWithSubject
          if (updated.status !== 'pending') {
            setRequests((prev) => prev.filter((r) => r.id !== updated.id))
          }
        }
      )
      .subscribe()

    // Fallback polling — odpala co 15 sekund gdy Realtime zawiedzie
    const pollId = setInterval(refetch, 15_000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(pollId)
    }
  }, [refetch])

  return requests
}
