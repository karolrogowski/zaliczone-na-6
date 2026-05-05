import type { SubmitRequestFormState } from './types'

export function validateSubmitRequest(fields: {
  subject_id: string
}): SubmitRequestFormState {
  if (!fields.subject_id.trim())
    return { errors: { subject_id: ['Wybierz przedmiot'] } }
  return undefined
}
