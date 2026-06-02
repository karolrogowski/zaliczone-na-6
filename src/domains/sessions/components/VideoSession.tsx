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
        <p className="text-[13px] text-[#888780]">Sesja zakończona. Przekierowanie...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {endError && (
        <div className="rounded-[12px] border border-red-300 bg-red-50 px-4 py-3 text-center text-[13px] font-medium text-red-700">
          Nie udało się zakończyć sesji. Sprawdź połączenie i spróbuj ponownie.
        </div>
      )}

      {/* Baner timera */}
      {isCritical ? (
        <div
          data-testid="timer-banner-critical"
          className="rounded-[12px] border border-red-300 bg-red-50 px-4 py-3 text-center text-[13px] font-semibold text-red-700"
        >
          Sesja kończy się za{' '}
          <span data-testid="timer" suppressHydrationWarning>{formatted}</span>!
        </div>
      ) : isWarning ? (
        <div
          data-testid="timer-banner-warning"
          className="rounded-[12px] border border-[#BA7517]/30 bg-[#FAEEDA] px-4 py-3 text-center text-[13px] font-medium text-[#633806]"
        >
          Zbliża się koniec sesji —{' '}
          <span data-testid="timer" suppressHydrationWarning>Pozostało: {formatted}</span>
        </div>
      ) : (
        <div
          data-testid="timer-normal"
          className="bg-white border border-[#e8e6de] rounded-[12px] px-4 py-3 text-center text-[13px] text-[#5f5e5a]"
        >
          <span data-testid="timer" suppressHydrationWarning>Pozostało: {formatted}</span>
        </div>
      )}

      {/* Iframe wideo */}
      <div className="relative overflow-hidden rounded-[12px] border border-[#e8e6de]" style={{ height: '70vh' }}>
        {!videoLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#1a1a18] text-white">
            <svg className="h-8 w-8 animate-spin text-[#888780]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <p className="text-[13px] font-medium text-[#d3d1c7]">
              {isTutor ? 'Przygotowywanie pokoju wideo...' : 'Oczekiwanie na połączenie z korepetytorem...'}
            </p>
            <p className="text-[12px] text-[#888780]">Może to potrwać kilka sekund</p>
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
        <div className="bg-white border border-[#e8e6de] rounded-[12px] p-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="session-notes" className="text-[13px] font-medium text-[#2c2c2a]">
              Notatki z sesji
              <span className="ml-1 font-normal text-[#888780]">(widoczne dla ucznia w historii)</span>
            </label>
            <textarea
              id="session-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Omówiony materiał, zadania domowe, wskazówki..."
              className="w-full px-3 py-[10px] border-[0.5px] border-[#d3d1c7] rounded-[8px] text-[13px] text-[#2c2c2a] bg-white outline-none placeholder:text-[#8a8980] focus:border-[#185FA5] focus:ring-2 focus:ring-[#185FA5]/15 transition-shadow font-[inherit] resize-none"
              rows={3}
            />
          </div>

          <button
            onClick={handleEndClick}
            disabled={isPending}
            className="cursor-pointer rounded-[8px] bg-red-600 px-4 py-[9px] text-[13px] font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            Zakończ sesję
          </button>
        </div>
      ) : (
        <div className="bg-white border border-[#e8e6de] rounded-[12px] px-4 py-3">
          <p className="text-[13px] text-[#888780]">
            Korepetytor może zakończyć sesję przed czasem.
          </p>
        </div>
      )}

      {/* Modal potwierdzenia zakończenia sesji */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-[16px] bg-white p-6 shadow-2xl flex flex-col gap-5">
            <div>
              <h3 className="text-[16px] font-semibold text-[#2c2c2a]">Zakończyć sesję?</h3>
              <p className="mt-1 text-[13px] text-[#5f5e5a]">
                Sesja zostanie zakończona, a uczeń zostanie poproszony o wystawienie oceny.
              </p>
            </div>

            {notes.trim() && (
              <div className="rounded-[8px] border border-[#e8e6de] bg-[#f5f5f3] p-3">
                <p className="mb-1 text-[11px] font-medium text-[#888780]">Notatki, które zostaną zapisane:</p>
                <p className="text-[13px] text-[#2c2c2a] whitespace-pre-wrap line-clamp-4">{notes.trim()}</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleConfirm}
                disabled={isPending}
                className="cursor-pointer flex-1 rounded-[8px] bg-red-600 px-4 py-[9px] text-[13px] font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? 'Kończenie...' : 'Tak, zakończ'}
              </button>
              <button
                onClick={handleCancel}
                disabled={isPending}
                className="cursor-pointer rounded-[8px] border border-[#e8e6de] bg-white px-4 py-[9px] text-[13px] font-medium text-[#2c2c2a] hover:bg-[#f5f5f3] disabled:opacity-50 transition-colors"
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}