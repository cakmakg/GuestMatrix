import type { NextRequest } from 'next/server'

import { handleRouteError, NotFoundError, ValidationError } from '@/lib/auth/errors'
import { requireTenantAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { moderationSchema, submissionIdParam } from '@/lib/validation/schemas'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> },
): Promise<Response> {
  try {
    const rawParams = await params
    const parsedParams = submissionIdParam.safeParse(rawParams)
    if (!parsedParams.success) throw new ValidationError('Invalid submission ID.')

    const { submissionId } = parsedParams.data
    const { tenantId } = await requireTenantAuth()

    const body: unknown = await request.json().catch(() => null)
    const parsed = moderationSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid request.')
    }

    // Verify the submission belongs to this tenant
    const { data: existing } = await supabaseAdmin
      .from('submissions')
      .select('id')
      .eq('id', submissionId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single<{ id: string }>()

    if (!existing) throw new NotFoundError('Submission')

    const { error } = await supabaseAdmin
      .from('submissions')
      .update({ moderation_flag: parsed.data.moderationFlag })
      .eq('id', submissionId)

    if (error) {
      return Response.json({ error: 'Something went wrong.' }, { status: 500 })
    }

    return Response.json({ ok: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
