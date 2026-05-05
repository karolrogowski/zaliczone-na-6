'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/shared/supabase/client'
import type { MatchingRequestWithSubject } from '../types'

export function useTutorRequests(initial: MatchingRequestWithSubject[]) {
  const [requests, setRequests] = useState(initial)

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('tutor-matching-requests')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'matching_requests' },
        (payload) => {
          const incoming = payload.new as MatchingRequestWithSubject
          setRequests((prev) => {
            if (prev.find((r) => r.id === incoming.id)) return prev
            return [incoming, ...prev]
          })
        }
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

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return requests
}
