'use server'

import { revalidatePath } from 'next/cache'

import { NotFoundError } from '@/lib/auth/errors'
import { requireTenantAuth } from '@/lib/auth/session'
import { logger } from '@/lib/logger'
import { deleteSubmission } from '@/lib/submissions/delete-submission'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function moderateAction(submissionId: string, flag: boolean): Promise<void> {
  const { tenantId } = await requireTenantAuth()

  const { data: sub } = await supabaseAdmin
    .from('submissions')
    .select('id, event_id, tenant_id')
    .eq('id', submissionId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .single<{ id: string; event_id: string; tenant_id: string }>()

  if (!sub) throw new NotFoundError('Submission')

  await supabaseAdmin.from('submissions').update({ moderation_flag: flag }).eq('id', submissionId)

  logger.info('[dashboard] moderation_flag set', { submissionId, flag, tenantId })
  revalidatePath(`/dashboard/events/${sub.event_id}`)
}

export async function deleteFromDashboardAction(submissionId: string): Promise<void> {
  await requireTenantAuth()

  // event_id für revalidatePath — ownership-scoped über den Server-Client (tenant_select RLS).
  // Nicht sichtbar = nicht dem eigenen Tenant → NotFoundError, noch vor der Löschung.
  const supabase = await createSupabaseServerClient()
  const { data: sub } = await supabase
    .from('submissions')
    .select('event_id')
    .eq('id', submissionId)
    .is('deleted_at', null)
    .single<{ event_id: string }>()

  if (!sub) throw new NotFoundError('Submission')

  // Fail-safe GDPR-Löschung (Storage hard-delete + Soft-Delete, Ownership in der DB).
  await deleteSubmission(submissionId)

  logger.info('[dashboard] submission deleted by tenant', { submissionId })
  revalidatePath(`/dashboard/events/${sub.event_id}`)
}
