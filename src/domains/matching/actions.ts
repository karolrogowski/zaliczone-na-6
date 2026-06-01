'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/shared/supabase/server'
import { getCurrentUser, getCurrentUserOrNull } from '@/shared/auth/getCurrentUser'
import { validateSubmitRequest, validateRatingComment } from './validation'
import { LEVEL_OPTIONS, SCOPE_OPTIONS, resolveOption } from './options'
import type { AcceptRequestResult, RatingFormState, SubmitRequestFormState } from './types'
import { createVideoRoom, deleteVideoRoom } from '@/domains/sessions/video-provider'

export async function submitMatchingRequest(
  _state: SubmitRequestFormState,
  formData: FormData
): Promise<SubmitRequestFormState> {
  const subject_id  = (formData.get('subject_id')  as string | null)?.trim() ?? ''
  const levelCode   = (formData.get('level')        as string | null)?.trim() ?? ''
  const levelOther  = (formData.get('level_other')  as string | null)?.trim() ?? ''
  const scopeCode   = (formData.get('scope')        as string | null)?.trim() ?? ''
  const scopeOther  = (formData.get('scope_other')  as string | null)?.trim() ?? ''
  const description = (formData.get('description')  as string | null)?.trim() ?? ''

  const level = resolveOption(LEVEL_OPTIONS, levelCode, levelOther)
  const scope = resolveOption(SCOPE_OPTIONS, scopeCode, scopeOther)

  const validationError = validateSubmitRequest({ subject_id, level, scope, description })
  if (validationError) return validationError

  const user = await getCurrentUserOrNull()
  if (!user) return { message: 'Nie jesteś zalogowany.' }

  const supabase = await createClient()

  const { error } = await supabase
    .from('matching_requests')
    .insert({ subject_id, level, scope, description, student_id: user.id })

  if (error) {
    return { message: 'Nie udało się wysłać zlecenia. Spróbuj ponownie.' }
  }

  redirect('/dashboard')
}

export async function cancelMatchingRequest(requestId: string): Promise<void> {
  const user = await getCurrentUser()

  const supabase = await createClient()

  await supabase
    .from('matching_requests')
    .update({ status: 'cancelled' })
    .eq('id', requestId)
    .eq('student_id', user.id)
    .eq('status', 'pending')

  revalidatePath('/dashboard')
}

export async function acceptMatchingRequest(
  requestId: string
): Promise<AcceptRequestResult> {
  const user = await getCurrentUserOrNull()
  if (!user) return { success: false, message: 'Nie jesteś zalogowany.' }

  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'tutor') return { success: false, message: 'Brak uprawnień.' }

  const { data } = await supabase
    .from('matching_requests')
    .update({ status: 'accepted', tutor_id: user.id })
    .eq('id', requestId)
    .eq('status', 'pending')
    .is('tutor_id', null)
    .select('student_id')
    .maybeSingle()

  if (!data) {
    return { success: false, message: 'Ktoś inny przyjął to zlecenie.' }
  }

  // Tworzy sesję — punkt wejścia do połączenia wideo
  const { data: session } = await supabase
    .from('sessions')
    .insert({
      matching_request_id: requestId,
      student_id: data.student_id,
      tutor_id: user.id,
    })
    .select('id')
    .single()

  // Tworzy pokój wideo i aktualizuje sesję
  if (session) {
    try {
      const room = await createVideoRoom()
      await supabase
        .from('sessions')
        .update({
          daily_room_name: room.name,
          daily_room_url: room.url,
          host_room_url: room.hostUrl,
          status: 'in_progress',
          started_at: new Date().toISOString(),
        })
        .eq('id', session.id)
    } catch (err) {
      console.error('[video] Nie udało się utworzyć pokoju wideo, sesja anulowana:', err)
      await supabase.from('sessions').delete().eq('id', session.id)
      await supabase
        .from('matching_requests')
        .update({ status: 'pending', tutor_id: null })
        .eq('id', requestId)
      return { success: false, message: 'Nie udało się uruchomić sesji wideo. Spróbuj ponownie.' }
    }
  }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function completeMatchingRequest(requestId: string): Promise<void> {
  const user = await getCurrentUserOrNull()
  if (!user) return

  const supabase = await createClient()

  // Znajdź sesję powiązaną ze zleceniem. RLS pokazuje sesję tylko uczestnikom,
  // więc maybeSingle() = null dla użytkownika bez uprawnień.
  const { data: session } = await supabase
    .from('sessions')
    .select('id, daily_room_name')
    .eq('matching_request_id', requestId)
    .maybeSingle()

  if (!session) return

  // RPC complete_session atomowo aktualizuje sesję + matching_request,
  // z walidacją autoryzacji po stronie bazy. Wcześniej każdy uczestnik mógł
  // wywołać tę akcję, a logika rozproszona była między dwoma UPDATE-ami.
  await supabase.rpc('complete_session', {
    p_session_id: session.id,
    p_notes: null,
  })

  if (session.daily_room_name) {
    await deleteVideoRoom(session.daily_room_name)
  }

  revalidatePath('/dashboard')
}

export async function submitRating(
  _state: RatingFormState,
  formData: FormData
): Promise<RatingFormState> {
  const requestId  = (formData.get('request_id') as string | null) ?? ''
  const ratedByRaw = (formData.get('rated_by') as string | null) ?? 'student'
  const ratedBy: 'student' | 'tutor' = ratedByRaw === 'tutor' ? 'tutor' : 'student'
  const comment    = (formData.get('comment')   as string | null)?.trim() ?? ''

  // preference dotyczy tylko ucznia
  const preferenceRaw = (formData.get('preference') as string | null) ?? ''
  const preference: 'want_again' | 'avoid' | null =
    preferenceRaw === 'want_again' ? 'want_again' :
    preferenceRaw === 'avoid'      ? 'avoid'      : null

  // tutor_preference dotyczy tylko korepetytora
  const tutorPreferenceRaw = (formData.get('tutor_preference') as string | null) ?? ''
  const tutorPreference: 'flag' | null = tutorPreferenceRaw === 'flag' ? 'flag' : null

  // Score wymagany tylko dla ucznia
  const scoreRaw = ratedBy === 'student'
    ? parseInt((formData.get('score') as string | null) ?? '0', 10)
    : null

  if (ratedBy === 'student' && (!scoreRaw || scoreRaw < 1 || scoreRaw > 5)) {
    return { errors: { score: ['Wybierz ocenę od 1 do 5 gwiazdek'] } }
  }

  if (ratedBy === 'student') {
    const commentError = validateRatingComment(comment, scoreRaw!)
    if (commentError) return { errors: { comment: [commentError] } }
  } else {
    const commentError = validateRatingComment(comment)
    if (commentError) return { errors: { comment: [commentError] } }
  }

  const user = await getCurrentUserOrNull()
  if (!user) return { message: 'Nie jesteś zalogowany.' }

  const supabase = await createClient()

  const { data: session } = await supabase
    .from('sessions')
    .select('id, student_id, tutor_id, status')
    .eq('matching_request_id', requestId)
    .maybeSingle()

  if (!session) return { message: 'Nie znaleziono sesji dla tego zlecenia.' }
  if (session.status !== 'completed') return { message: 'Sesja nie została jeszcze zakończona.' }

  // Weryfikacja: użytkownik musi być odpowiednim uczestnikiem sesji
  if (ratedBy === 'student' && session.student_id !== user.id) {
    return { message: 'Brak uprawnień do wystawienia tej oceny.' }
  }
  if (ratedBy === 'tutor' && session.tutor_id !== user.id) {
    return { message: 'Brak uprawnień do wystawienia tej oceny.' }
  }

  const { error } = await supabase.from('ratings').insert({
    session_id: session.id,
    student_id: session.student_id,
    tutor_id:   session.tutor_id,
    score:      scoreRaw,
    comment:    comment || null,
    rated_by:         ratedBy,
    preference:       ratedBy === 'student' ? preference       : null,
    tutor_preference: ratedBy === 'tutor'   ? tutorPreference  : null,
  })

  if (error) {
    if (error.code === '23505') return { message: 'Ta sesja została już oceniona.' }
    return { message: 'Nie udało się zapisać oceny. Spróbuj ponownie.' }
  }

  redirect('/dashboard?ocena=zapisana')
}

/**
 * Usuwa korepetytora z listy ulubionych ucznia.
 * Aktualizuje WSZYSTKIE oceny ucznia dla tego korepetytora (może być wiele sesji).
 */
export async function removeFavoriteTutor(tutorId: string): Promise<void> {
  const user = await getCurrentUserOrNull()
  if (!user) return

  const supabase = await createClient()

  await supabase
    .from('ratings')
    .update({ preference: null })
    .eq('rated_by', 'student')
    .eq('preference', 'want_again')
    .eq('student_id', user.id)
    .eq('tutor_id', tutorId)

  revalidatePath('/settings')
}

/**
 * Usuwa preferencję 'avoid' dla danego korepetytora.
 * Aktualizuje WSZYSTKIE oceny ucznia dla tego korepetytora (może być wiele sesji),
 * żeby filtr w getTutorPendingRequests przestał działać dla tej pary.
 */
export async function removeAvoidPreference(tutorId: string): Promise<void> {
  const user = await getCurrentUserOrNull()
  if (!user) return

  const supabase = await createClient()

  await supabase
    .from('ratings')
    .update({ preference: null })
    .eq('rated_by', 'student')
    .eq('preference', 'avoid')
    .eq('student_id', user.id)
    .eq('tutor_id', tutorId)

  revalidatePath('/settings')
}

export async function toggleTutorAvailability(isAvailable: boolean): Promise<void> {
  const user = await getCurrentUserOrNull()
  if (!user) return

  const supabase = await createClient()

  await supabase
    .from('tutor_profiles')
    .update({ is_available: isAvailable })
    .eq('id', user.id)

  revalidatePath('/dashboard')
}
