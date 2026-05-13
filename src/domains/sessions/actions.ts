'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/shared/supabase/server'

export async function completeSession(sessionId: string, reason?: string): Promise<void> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Nie jesteś zalogowany.')

  const { data: session } = await supabase
    .from('sessions')
    .select('id, student_id, tutor_id, matching_request_id, status')
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
    })
    .eq('id', sessionId)

  // reason jest przechowywany tylko po stronie klienta (logowanie) — brak kolumny w schemacie
  void reason

  if (session.matching_request_id) {
    await supabase
      .from('matching_requests')
      .update({ status: 'completed' })
      .eq('id', session.matching_request_id)
      .eq('status', 'accepted')
  }

  revalidatePath('/dashboard')
  revalidatePath(`/session/${sessionId}`)
}