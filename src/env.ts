export {}

const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'WHEREBY_API_KEY',
] as const

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Brakuje zmiennej środowiskowej: ${key}`)
  }
}