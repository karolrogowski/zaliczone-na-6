'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/shared/supabase/server'
import { deleteVideoRoom } from './video-provider'

export async function completeSession(sessionId: string, notes?: string): Promise<void> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Nie jesteś zalogowany.')

  const { data: session } = await supabase
    .from('sessions')
    .select('id, student_id, tutor_id, matching_request_id, status, daily_room_name')
    .eq('id', sessionId)
    .maybeSingle()

  if (!session) throw new Error('Nie znaleziono sesji.')

  const isParticipant = session.student_id === user.id || session.tutor_id === user.id
  if (!isParticipant) throw new Error('Nie masz dostępu do tej sesji.')

  if (session.status === 'completed') return

  await supabase
    .from('sessions')
    .update({
      status: 'completed',
      ended_at: new Date().toISOString(),
      ...(notes?.trim() ? { notes: notes.trim() } : {}),
    })
    .eq('id', sessionId)

  if (session.matching_request_id) {
    await supabase
      .from('matching_requests')
      .update({ status: 'completed' })
      .eq('id', session.matching_request_id)
      .eq('status', 'accepted')
  }

  revalidatePath('/dashboard')
  revalidatePath(`/session/${sessionId}`)

  // Usuń pokój wideo — best-effort, nie blokuje zakończenia sesji
  if (session.daily_room_name) {
    void deleteVideoRoom(session.daily_room_name)
  }
}