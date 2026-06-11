import { createClient } from '@/shared/supabase/server'

export async function getSessionPriceGrosz(): Promise<number> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('platform_config')
    .select('value')
    .eq('key', 'session_price_grosz')
    .single()

  return data ? parseInt(data.value, 10) : 10000
}
