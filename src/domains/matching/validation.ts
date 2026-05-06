import type { SubmitRequestFormState } from './types'

export function validateSubmitRequest(fields: {
  subject_id: string
  level: string
  scope: string
  description: string
}): SubmitRequestFormState {
  const errors: NonNullable<SubmitRequestFormState>['errors'] = {}

  if (!fields.subject_id.trim())
    errors.subject_id = ['Wybierz przedmiot']
  if (!fields.level.trim())
    errors.level = ['Wybierz poziom']
  if (!fields.scope.trim())
    errors.scope = ['Wybierz zakres']
  if (!fields.description.trim())
    errors.description = ['Opisz zagadnienia — korepetytor musi wiedzieć z czym potrzebujesz pomocy']

  if (Object.keys(errors).length > 0) return { errors }
  return undefined
}
