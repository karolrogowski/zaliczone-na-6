'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/shared/supabase/server'
import { validateSubmitRequest } from './validation'
import { LEVEL_OPTIONS, SCOPE_OPTIONS, resolveOption } from './options'
import type { AcceptRequestResult, RatingFormState, SubmitRequestFormState } from './types'
import { createVideoRoom } from '@/domains/sessions/video-provider'

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

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { message: 'Nie jesteś zalogowany.' }

  const { error } = await supabase
    .from('matching_requests')
    .insert({ subject_id, level, scope, description, student_id: user.id })

  if (error) {
    return { message: 'Nie udało się wysłać zlecenia. Spróbuj ponownie.' }
  }

  redirect('/dashboard')
}

export async function cancelMatchingRequest(requestId: string): Promise<void> {
  const supabase = await createClient()

  await supabase
    .from('matching_requests')
    .update({ status: 'cancelled' })
    .eq('id', requestId)
    .eq('status', 'pending')

  revalidatePath('/dashboard')
}

export async function acceptMatchingRequest(
  requestId: string
): Promise<AcceptRequestResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'Nie jesteś zalogowany.' }

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
  }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function completeMatchingRequest(requestId: string): Promise<void> {
  const supabase = await createClient()

  await supabase
    .from('matching_requests')
    .update({ status: 'completed' })
    .eq('id', requestId)
    .eq('status', 'accepted')

  // Oznacza powiązaną sesję jako zakończoną (wymagane przed wystawieniem oceny)
  const { data: session } = await supabase
    .from('sessions')
    .select('id')
    .eq('matching_request_id', requestId)
    .maybeSingle()

  if (session) {
    await supabase
      .from('sessions')
      .update({ status: 'completed', ended_at: new Date().toISOString() })
      .eq('id', session.id)
  }

  revalidatePath('/dashboard')
}

export async function submitRating(
  _state: RatingFormState,
  formData: FormData
): Promise<RatingFormState> {
  const requestId = (formData.get('request_id') as string | null) ?? ''
  const score = parseInt((formData.get('score') as string | null) ?? '0', 10)
  const comment = (formData.get('comment') as string | null)?.trim() ?? ''

  if (!score || score < 1 || score > 5) {
    return { errors: { score: ['Wybierz ocenę od 1 do 5 gwiazdek'] } }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { message: 'Nie jesteś zalogowany.' }

  const { data: session } = await supabase
    .from('sessions')
    .select('id, tutor_id, status')
    .eq('matching_request_id', requestId)
    .maybeSingle()

  if (!session) return { message: 'Nie znaleziono sesji dla tego zlecenia.' }
  if (session.status !== 'completed') return { message: 'Sesja nie została jeszcze zakończona.' }

  const { error } = await supabase.from('ratings').insert({
    session_id: session.id,
    student_id: user.id,
    tutor_id: session.tutor_id,
    score,
    comment: comment || null,
  })

  if (error) {
    if (error.code === '23505') return { message: 'Ta sesja została już oceniona.' }
    return { message: 'Nie udało się zapisać oceny. Spróbuj ponownie.' }
  }

  redirect('/dashboard')
}

export async function toggleTutorAvailability(isAvailable: boolean): Promise<void> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('tutor_profiles')
    .update({ is_available: isAvailable })
    .eq('id', user.id)

  revalidatePath('/dashboard')
}
