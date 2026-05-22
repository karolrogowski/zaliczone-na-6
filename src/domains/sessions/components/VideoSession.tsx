'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { completeSession } from '../actions'
import { subscribeToSession } from '@/shared/realtime/adapter'
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

  // null podczas SSR — unikamy hydration mismatch (Date.now() różni się między serwerem a klientem)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  useEffect(() => {
    const id = setInterval(() => setSecondsLeft(calcRemaining()), 1000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAt, durationMinutes])

  // null podczas SSR → obliczamy wprost przy renderze; suppressHydrationWarning na spanach tłumi mismatch
  const secs = secondsLeft ?? calcRemaining()
  const minutes = Math.floor(secs / 60)
  const seconds = secs % 60
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
  const [notes, setNotes] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [ended, setEnded] = useState(false)
  const [videoLoaded, setVideoLoaded] = useState(false)
  const [endError, setEndError] = useState(false)
  const autoEndFired = useRef(false)

  const { secondsLeft, formatted } = useSessionTimer(startedAt, durationMinutes)

  const isWarning = secondsLeft !== null && secondsLeft > 0 && secondsLeft <= 120
  const isCritical = secondsLeft !== null && secondsLeft > 0 && secondsLeft <= 30

  // Automatyczne zakończenie sesji po upływie czasu
  useEffect(() => {
    if (secondsLeft === 0 && !autoEndFired.current && !ended) {
      autoEndFired.current = true
      startTransition(async () => {
        try {
          await completeSession(sessionId)
          setEnded(true)
          router.push(`/rate/${matchingRequestId}`)
        } catch {
          autoEndFired.current = false
          setEndError(true)
        }
      })
    }
  }, [secondsLeft, sessionId, matchingRequestId, router, ended])

  // Wykrywanie zakończenia sesji przez drugą stronę (Realtime + fallback polling)
  useEffect(() => {
    if (ended) return

    function handleSessionEnd() {
      setEnded(true)
      router.push(`/rate/${matchingRequestId}`)
    }

    async function pollSessionStatus() {
      const supabase = createClient()
      const { data } = await supabase
        .from('sessions')
        .select('status')
        .eq('id', sessionId)
        .single()
      if (data?.status === 'completed') handleSessionEnd()
    }

    return subscribeToSession({
      sessionId,
      onUpdate: ({ status }) => { if (status === 'completed') handleSessionEnd() },
      pollingFn: pollSessionStatus,
      pollingIntervalMs: 5_000,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, matchingRequestId])

  function handleEndClick() {
    setConfirming(true)
  }

  function handleConfirm() {
    setConfirming(false)
    startTransition(async () => {
      try {
        await completeSession(sessionId, notes.trim() || undefined)
        setEnded(true)
        router.push(`/rate/${matchingRequestId}`)
      } catch {
        setEndError(true)
      }
    })
  }

  function handleCancel() {
    setConfirming(false)
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
      {endError && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-700">
          Nie udało się zakończyć sesji. Sprawdź połączenie i spróbuj ponownie.
        </div>
      )}

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
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation allow-popups-to-escape-sandbox"
          style={{ width: '100%', height: '100%', border: 'none', opacity: videoLoaded ? 1 : 0 }}
          title="Sesja wideo"
          onLoad={() => setVideoLoaded(true)}
        />
      </div>

      {/* Kontrolki sesji */}
      {isTutor ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="session-notes" className="text-sm font-medium text-zinc-700">
              Notatki z sesji
              <span className="ml-1 font-normal text-zinc-400">(widoczne dla ucznia w historii)</span>
            </label>
            <textarea
              id="session-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Omówiony materiał, zadania domowe, wskazówki..."
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 resize-none focus:outline-none focus:ring-2 focus:ring-zinc-300"
              rows={3}
            />
          </div>

          {confirming ? (
            <div className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm font-medium text-red-700">Na pewno zakończyć sesję?</p>
              <div className="flex gap-2">
                <button
                  onClick={handleConfirm}
                  disabled={isPending}
                  className="cursor-pointer rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {isPending ? 'Kończenie...' : 'Tak, zakończ'}
                </button>
                <button
                  onClick={handleCancel}
                  className="cursor-pointer rounded-lg border border-zinc-200 bg-white px-4 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                >
                  Anuluj
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleEndClick}
              disabled={isPending}
              className="cursor-pointer rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              Zakończ sesję
            </button>
          )}
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