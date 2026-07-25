import type { NextRequest } from 'next/server'

import {
  handleRouteError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from '@/lib/auth/errors'
import { requireAnyAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { submissionIdParam } from '@/lib/validation/schemas'

const BUCKET = 'ugc-media'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> },
): Promise<Response> {
  try {
    const rawParams = await params
    const parsedParams = submissionIdParam.safeParse(rawParams)
    if (!parsedParams.success) throw new ValidationError('Invalid submission ID.')

    const { submissionId } = parsedParams.data
    const { userId } = await requireAnyAuth()

    const supabase = await createSupabaseServerClient()
    const { data: user } = await supabase.auth.getUser()
    const isAnonymous = user.user?.is_anonymous ?? true

    // Fetch submission to verify ownership before deleting
    const { data: submission } = await supabaseAdmin
      .from('submissions')
      .select('id, guest_user_id, tenant_id, media_url')
      .eq('id', submissionId)
      .is('deleted_at', null)
      .single<{ id: string; guest_user_id: string; tenant_id: string; media_url: string | null }>()

    if (!submission) throw new NotFoundError('Submission')

    // Anonymous guest: can only delete their own submission
    // Tenant user: checked by verifying tenant_id matches
    if (isAnonymous) {
      if (submission.guest_user_id !== userId) throw new AuthorizationError()
    } else {
      // Verify the authenticated user is the tenant who owns this submission
      const { data: tenant } = await supabaseAdmin
        .from('tenants')
        .select('id')
        .eq('user_id', userId)
        .single<{ id: string }>()

      if (!tenant || tenant.id !== submission.tenant_id) throw new AuthorizationError()
    }

    // Soft delete: set deleted_at timestamp
    await supabaseAdmin
      .from('submissions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', submissionId)

    // Hard delete from Storage (DSGVO: personal data must be fully erasable)
    if (submission.media_url) {
      await supabaseAdmin.storage.from(BUCKET).remove([submission.media_url])
    }

    return Response.json({ ok: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
