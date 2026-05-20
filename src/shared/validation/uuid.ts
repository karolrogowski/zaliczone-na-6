// RFC 4122: UUID v1-v5 — wystarczająco luźny żeby przepuścić każdy uuid generowany
// przez Postgres (`gen_random_uuid()` zwraca v4) ale odrzuca śmieci typu numery
// rosnące, JSON, slugi tekstowe.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(value: string | undefined | null): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value)
}