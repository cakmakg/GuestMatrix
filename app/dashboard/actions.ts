'use server'

import { revalidatePath } from 'next/cache'

import { requireEventOwnership, requireTenantAuth } from '@/lib/auth/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function setEventArchivedAction(eventId: string, archived: boolean): Promise<void> {
  const { tenantId } = await requireTenantAuth()
  await requireEventOwnership(tenantId, eventId)

  const supabase = await createSupabaseServerClient()
  await supabase
    .from('events')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', eventId)
    .eq('tenant_id', tenantId)

  revalidatePath('/dashboard')
}
