'use server'

import { revalidatePath } from 'next/cache'

import { AuthorizationError, NotFoundError } from '@/lib/auth/errors'
import { requireTenantAuth } from '@/lib/auth/session'
import { logger } from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase/admin'

const BUCKET = 'ugc-media'

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
  const { tenantId } = await requireTenantAuth()

  const { data: sub } = await supabaseAdmin
    .from('submissions')
    .select('id, event_id, tenant_id, media_url')
    .eq('id', submissionId)
    .is('deleted_at', null)
    .single<{ id: string; event_id: string; tenant_id: string; media_url: string | null }>()

  if (!sub) throw new NotFoundError('Submission')
  if (sub.tenant_id !== tenantId) throw new AuthorizationError()

  await supabaseAdmin
    .from('submissions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', submissionId)

  if (sub.media_url) {
    await supabaseAdmin.storage.from(BUCKET).remove([sub.media_url])
  }

  logger.info('[dashboard] submission deleted by tenant', { submissionId, tenantId })
  revalidatePath(`/dashboard/events/${sub.event_id}`)
}
