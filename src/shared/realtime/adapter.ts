'use client'

/**
 * Adapter Realtime — jedyne miejsce do zmiany przy przełączaniu mechanizmu
 * subskrypcji zmian w czasie rzeczywistym (Supabase Realtime, WebSocket, SSE).
 *
 * Wszystkie trzy użycia (feed korepetytora, status zlecenia ucznia, status sesji)
 * korzystają z tych samych prymitywów: subskrypcja + polling fallback.
 *
 * Wzorzec identyczny jak src/domains/sessions/video-provider.ts.
 */

import { createClient } from '@/shared/supabase/client'

type Cleanup = () => void

// ─── Feed zleceń (korepetytor) ────────────────────────────────────────────────

export function subscribeToMatchingRequests(opts: {
  channelName: string
  onInsert: () => void
  onUpdate: (newRecord: { id: string; status: string }) => void
  pollingFn: () => void
  pollingIntervalMs?: number
}): Cleanup {
  const { channelName, onInsert, onUpdate, pollingFn, pollingIntervalMs = 8_000 } = opts
  const supabase = createClient()

  const channel = supabase
    .channel(channelName)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'matching_requests' }, onInsert)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matching_requests' },
      (payload) => onUpdate(payload.new as { id: string; status: string })
    )
    .subscribe()

  const pollId = setInterval(pollingFn, pollingIntervalMs)

  return () => {
    supabase.removeChannel(channel)
    clearInterval(pollId)
  }
}

// ─── Pojedyncze zlecenie (uczeń) ──────────────────────────────────────────────

export function subscribeToMatchingRequest(opts: {
  requestId: string
  onChange: () => void
  pollingIntervalMs?: number
}): Cleanup {
  const { requestId, onChange, pollingIntervalMs = 5_000 } = opts
  const supabase = createClient()

  const channel = supabase
    .channel(`matching-request-${requestId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'matching_requests',
      filter: `id=eq.${requestId}`,
    }, onChange)
    .subscribe()

  const pollId = setInterval(onChange, pollingIntervalMs)

  return () => {
    supabase.removeChannel(channel)
    clearInterval(pollId)
  }
}

// ─── Sesja wideo ──────────────────────────────────────────────────────────────

export function subscribeToSession(opts: {
  sessionId: string
  onUpdate: (newRecord: { status: string }) => void
  pollingFn: () => void
  pollingIntervalMs?: number
}): Cleanup {
  const { sessionId, onUpdate, pollingFn, pollingIntervalMs = 5_000 } = opts
  const supabase = createClient()

  const channel = supabase
    .channel(`session-${sessionId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'sessions',
      filter: `id=eq.${sessionId}`,
    }, (payload) => onUpdate(payload.new as { status: string }))
    .subscribe()

  const pollId = setInterval(pollingFn, pollingIntervalMs)

  return () => {
    supabase.removeChannel(channel)
    clearInterval(pollId)
  }
}