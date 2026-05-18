export {}

const always = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const

const productionOnly = [
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'WHEREBY_API_KEY',
] as const

const required = process.env.NODE_ENV === 'production'
  ? [...always, ...productionOnly]
  : always

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Brakuje zmiennej środowiskowej: ${key}`)
  }
}