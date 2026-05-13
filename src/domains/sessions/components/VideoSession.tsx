'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { completeSession } from '../actions'
import { createClient } from '@/shared/supabase/client'

type VideoSessionProps = {
  sessionId: string
  matchingRequestId: string
  dailyRoomUrl: string
  startedAt: string
  durationMinutes: number
  isTutor: boolean
}

function useSessionTimer(startedAt: string, durationMinutes: number) {
  const endTime = new Date(startedAt).getTime() + durationMinutes * 60 * 1000

  const calcRemaining = () => Math.max(0, Math.floor((endTime - Date.now()) / 1000))

  const [secondsLeft, setSecondsLeft] = useState(calcRemaining)

  useEffect(() => {
    const id = setInterval(() => setSecondsLeft(calcRemaining()), 1000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAt, durationMinutes])

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  return { secondsLeft, formatted }
}

export function VideoSession({
  sessionId,
  matchingRequestId,
  dailyRoomUrl,
  startedAt,
  durationMinutes,
  isTutor,
}: VideoSessionProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [reason, setReason] = useState('')
  const [showReasonError, setShowReasonError] = useState(false)
  const [ended, setEnded] = useState(false)
  const [videoLoaded, setVideoLoaded] = useState(false)
  const autoEndFired = useRef(false)

  const { secondsLeft, formatted } = useSessionTimer(startedAt, durationMinutes)

  const isWarning = secondsLeft > 0 && secondsLeft <= 120
  const isCritical = secondsLeft > 0 && secondsLeft <= 30

  // Automatyczne zakończenie sesji po upływie czasu
  useEffect(() => {
    if (secondsLeft === 0 && !autoEndFired.current && !ended) {
      autoEndFired.current = true
      startTransition(async () => {
        await completeSession(sessionId)
        setEnded(true)
        router.push(`/rate/${matchingRequestId}`)
      })
    }
  }, [secondsLeft, sessionId, matchingRequestId, router, ended])

  // Wykrywanie zakończenia sesji przez drugą stronę (Realtime + fallback polling)
  useEffect(() => {
    if (ended) return

    const supabase = createClient()

    async function checkStatus() {
      const { data } = await supabase
        .from('sessions')
        .select('status')
        .eq('id', sessionId)
        .single()
      if (data?.status === 'completed') {
        setEnded(true)
        router.push(`/rate/${matchingRequestId}`)
      }
    }

    const channel = supabase
      .channel(`session-end-${sessionId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
        (payload) => { if ((payload.new as { status: string }).status === 'completed') {
          setEnded(true)
          router.push(`/rate/${matchingRequestId}`)
        }}
      )
      .subscribe()

    const pollId = setInterval(checkStatus, 5_000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(pollId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, matchingRequestId])

  function handleComplete() {
    if (isTutor && secondsLeft > 30 && !reason.trim()) {
      setShowReasonError(true)
      return
    }
    setShowReasonError(false)
    startTransition(async () => {
      await completeSession(sessionId, reason.trim() || undefined)
      setEnded(true)
      router.push(`/rate/${matchingRequestId}`)
    })
  }

  if (ended) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-zinc-500">Sesja zakończona. Przekierowanie...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Baner timera */}
      {isCritical ? (
        <div
          data-testid="timer-banner-critical"
          className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-center font-semibold text-red-700"
        >
          Sesja kończy się za{' '}
          <span data-testid="timer" suppressHydrationWarning>{formatted}</span>!
        </div>
      ) : isWarning ? (
        <div
          data-testid="timer-banner-warning"
          className="rounded-xl border border-yellow-300 bg-yellow-50 px-4 py-3 text-center font-medium text-yellow-700"
        >
          Zbliża się koniec sesji —{' '}
          <span data-testid="timer" suppressHydrationWarning>Pozostało: {formatted}</span>
        </div>
      ) : (
        <div
          data-testid="timer-normal"
          className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-center text-sm text-zinc-600"
        >
          <span data-testid="timer" suppressHydrationWarning>Pozostało: {formatted}</span>
        </div>
      )}

      {/* Iframe wideo */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-200" style={{ height: '70vh' }}>
        {!videoLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-900 text-white">
            <svg className="h-8 w-8 animate-spin text-zinc-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <p className="text-sm font-medium text-zinc-300">
              {isTutor ? 'Przygotowywanie pokoju wideo...' : 'Oczekiwanie na połączenie z korepetytorem...'}
            </p>
            <p className="text-xs text-zinc-500">Może to potrwać kilka sekund</p>
          </div>
        )}
        <iframe
          src={dailyRoomUrl}
          allow="camera; microphone; fullscreen; speaker; display-capture; autoplay; clipboard-write; compute-pressure"
          style={{ width: '100%', height: '100%', border: 'none', opacity: videoLoaded ? 1 : 0 }}
          title="Sesja wideo"
          onLoad={() => setVideoLoaded(true)}
        />
      </div>

      {/* Kontrolki sesji */}
      {isTutor ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 flex flex-col gap-3">
          <p className="text-sm font-medium text-zinc-700">Zakończ sesję</p>
          {secondsLeft > 30 && (
            <div className="flex flex-col gap-1">
              <label htmlFor="end-reason" className="text-xs text-zinc-500">
                Powód wcześniejszego zakończenia <span className="text-red-500">*</span>
              </label>
              <textarea
                id="end-reason"
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value)
                  if (showReasonError) setShowReasonError(false)
                }}
                placeholder="Podaj powód zakończenia sesji przed czasem..."
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-zinc-300"
                rows={2}
              />
              {showReasonError && (
                <p className="text-xs text-red-500">
                  Podaj powód zakończenia sesji przed czasem.
                </p>
              )}
            </div>
          )}
          <button
            onClick={handleComplete}
            disabled={isPending}
            className="cursor-pointer rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Kończenie...' : 'Zakończ sesję'}
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
          <p className="text-sm text-zinc-500">
            Korepetytor może zakończyć sesję przed czasem.
          </p>
        </div>
      )}
    </div>
  )
}