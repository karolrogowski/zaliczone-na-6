'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/shared/supabase/server'
import { getCurrentUser } from '@/shared/auth/getCurrentUser'
import { MAX_NOTES } from '@/domains/matching/validation'
import { capturePayment } from '@/domains/payments/actions'
import { deleteVideoRoom } from './video-provider'

export async function completeSession(sessionId: string, notes?: string): Promise<void> {
  if (notes && notes.length > MAX_NOTES) {
    throw new Error(`Notatka nie może być dłuższa niż ${MAX_NOTES} znaków.`)
  }

  const user = await getCurrentUser()
  const supabase = await createClient()

  // Pobieramy session.daily_room_name na potrzeby deleteVideoRoom + sprawdzamy
  // dostęp. RLS pokazuje sesję tylko uczestnikom, więc maybeSingle() = null
  // dla obcego usera.
  const { data: session } = await supabase
    .from('sessions')
    .select('id, student_id, tutor_id, status, daily_room_name, matching_request_id')
    .eq('id', sessionId)
    .maybeSingle()

  if (!session) throw new Error('Nie znaleziono sesji.')

  const isParticipant = session.student_id === user.id || session.tutor_id === user.id
  if (!isParticipant) throw new Error('Nie masz dostępu do tej sesji.')

  if (session.status === 'completed') return

  // RPC complete_session (SECURITY DEFINER) waliduje autoryzację po stronie
  // bazy i atomowo aktualizuje sesję + matching_request. Notes ustawia tylko
  // gdy auth.uid() = tutor_id, niezależnie od tego co przyśle klient.
  const { error } = await supabase.rpc('complete_session', {
    p_session_id: sessionId,
    p_notes: notes?.trim() || null,
  })

  if (error) {
    throw new Error('Nie udało się zakończyć sesji.')
  }

  revalidatePath('/dashboard')
  revalidatePath(`/session/${sessionId}`)

  // Best-effort cleanup pokoju wideo
  if (session.daily_room_name) {
    void deleteVideoRoom(session.daily_room_name)
  }

  // Pobranie preautoryzowanej płatności (krok 6 planu płatności)
  void capturePayment(session.matching_request_id)
}