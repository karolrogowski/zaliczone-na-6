export function validateCommissionPct(value: string): string | null {
  const num = parseInt(value, 10)
  if (isNaN(num) || num < 0 || num > 100) {
    return 'Prowizja musi być liczbą całkowitą od 0 do 100'
  }
  return null
}
