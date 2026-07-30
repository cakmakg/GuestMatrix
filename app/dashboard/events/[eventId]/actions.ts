'use server'

import { revalidatePath } from 'next/cache'

import { NotFoundError } from '@/lib/auth/errors'
import { requireTenantAuth } from '@/lib/auth/session'
import { logger } from '@/lib/logger'
import { deleteSubmission } from '@/lib/submissions/delete-submission'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function moderateAction(submissionId: string, flag: boolean): Promise<void> {
  const { tenantId } = await requireTenantAuth()

  // Moderation läuft RLS-aktiv: Sichtbarkeit + Berechtigung erzwingen tenant_select_submissions
  // (Lesen) und tenant_update_submissions (Flag-Update) über tenant_id = current_tenant_id().
  // Kein service_role für die Flag-Mutation; die .eq('tenant_id')-Filter bleiben als Defense-in-Depth.
  const supabase = await createSupabaseServerClient()

  const { data: sub } = await supabase
    .from('submissions')
    .select('id, event_id, tenant_id')
    .eq('id', submissionId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .single<{ id: string; event_id: string; tenant_id: string }>()

  if (!sub) throw new NotFoundError('Submission')

  const { error } = await supabase
    .from('submissions')
    .update({ moderation_flag: flag })
    .eq('id', submissionId)
    .eq('tenant_id', tenantId)

  if (error) throw error

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
