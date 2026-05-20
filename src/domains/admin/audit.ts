import { headers } from 'next/headers'
import { createAdminClient } from '@/shared/supabase/admin'

type AuditEntry = {
  admin_id: string
  action: string
  target_type?: string | null
  target_id?: string | null
  payload?: Record<string, unknown>
}

// Zapis pojedynczego wpisu audytu — best-effort, nigdy nie blokuje akcji adminowej.
// Klient service role bo: 1) RLS uniemożliwiałoby INSERT, 2) wpis musi powstać
// nawet jeśli admin nie ma czytalności swojego loga.
export async function logAdminAction(entry: AuditEntry): Promise<void> {
  try {
    const headerList = await headers()
    const ip = headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null

    await createAdminClient()
      .from('admin_audit_log')
      .insert({
        admin_id: entry.admin_id,
        action: entry.action,
        target_type: entry.target_type ?? null,
        target_id: entry.target_id ?? null,
        payload: entry.payload ?? {},
        ip_address: ip,
      })
  } catch (err) {
    console.error('[audit] Nie udało się zapisać wpisu audytu:', err)
  }
}