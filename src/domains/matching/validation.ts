import type { SubmitRequestFormState } from './types'

// Limity bezpiecznikowe na pola tekstowe — chronią przed DoS przez payload
// i przed zbyt długim contentem zaśmiecającym UI innych użytkowników.
export const MAX_DESCRIPTION = 2000
export const MAX_LEVEL = 100
export const MAX_COMMENT = 1000
export const MAX_NOTES = 5000

export function validateSubmitRequest(fields: {
  subject_id: string
  level: string
  description: string
}): SubmitRequestFormState {
  const errors: NonNullable<SubmitRequestFormState>['errors'] = {}

  if (!fields.subject_id.trim())
    errors.subject_id = ['Wybierz przedmiot']

  if (!fields.level.trim())
    errors.level = ['Wybierz poziom']
  else if (fields.level.length > MAX_LEVEL)
    errors.level = [`Poziom nie może być dłuższy niż ${MAX_LEVEL} znaków`]

  if (!fields.description.trim())
    errors.description = ['Opisz zagadnienia — korepetytor musi wiedzieć z czym potrzebujesz pomocy']
  else if (fields.description.length > MAX_DESCRIPTION)
    errors.description = [`Opis nie może być dłuższy niż ${MAX_DESCRIPTION} znaków`]

  if (Object.keys(errors).length > 0) return { errors }
  return undefined
}

export const MIN_COMMENT_LOW_SCORE = 50

/**
 * Waliduje komentarz do oceny ucznia.
 * Gdy avgScore < 4, komentarz jest obowiązkowy (min. 50 znaków).
 * Parametr avgScore jest opcjonalny — bez niego sprawdzana jest tylko długość max.
 */
export function validateRatingComment(comment: string, avgScore?: number): string | null {
  if (avgScore !== undefined && avgScore < 4) {
    if (comment.length === 0)
      return `Przy ocenie poniżej 4 komentarz jest obowiązkowy (minimum ${MIN_COMMENT_LOW_SCORE} znaków)`
    if (comment.length < MIN_COMMENT_LOW_SCORE)
      return `Komentarz jest za krótki — minimum ${MIN_COMMENT_LOW_SCORE} znaków (aktualnie: ${comment.length})`
  }
  if (comment.length > MAX_COMMENT)
    return `Komentarz nie może być dłuższy niż ${MAX_COMMENT} znaków`
  return null
}