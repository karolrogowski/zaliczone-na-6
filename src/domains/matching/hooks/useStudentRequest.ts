'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/shared/supabase/client'
import type { MatchingRequestWithSubject } from '../types'

export function useStudentRequest(initial: MatchingRequestWithSubject | null) {
  const [request, setRequest] = useState(initial)

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
        (payload) => {
          setRequest((prev) =>
            prev ? { ...prev, ...(payload.new as MatchingRequestWithSubject) } : prev
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [initial?.id])

  return request
}
