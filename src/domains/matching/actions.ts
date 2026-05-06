'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/shared/supabase/server'
import { validateSubmitRequest } from './validation'
import { LEVEL_OPTIONS, SCOPE_OPTIONS, resolveOption } from './options'
import type { AcceptRequestResult, SubmitRequestFormState } from './types'

export async function submitMatchingRequest(
  _state: SubmitRequestFormState,
  formData: FormData
): Promise<SubmitRequestFormState> {
  const subject_id   = (formData.get('subject_id')    as string | null)?.trim() ?? ''
  const levelCode    = (formData.get('level')          as string | null)?.trim() ?? ''
  const levelOther   = (formData.get('level_other')    as string | null)?.trim() ?? ''
  const scopeCode    = (formData.get('scope')          as string | null)?.trim() ?? ''
  const scopeOther   = (formData.get('scope_other')    as string | null)?.trim() ?? ''
  const description  = (formData.get('description')   as string | null)?.trim() ?? ''

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
    .select()
    .maybeSingle()

  if (!data) {
    return { success: false, message: 'Ktoś inny przyjął to zlecenie.' }
  }

  revalidatePath('/dashboard')
  return { success: true }
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
