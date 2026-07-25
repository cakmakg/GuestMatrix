import type { NextRequest } from 'next/server'

import { handleRouteError, NotFoundError, ValidationError } from '@/lib/auth/errors'
import { requireAnyAuth } from '@/lib/auth/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ratingSchema, submissionIdParam } from '@/lib/validation/schemas'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> },
): Promise<Response> {
  try {
    const rawParams = await params
    const parsedParams = submissionIdParam.safeParse(rawParams)
    if (!parsedParams.success) throw new ValidationError('Invalid submission ID.')

    const { submissionId } = parsedParams.data
    const { userId } = await requireAnyAuth()

    const body: unknown = await request.json().catch(() => null)
    const parsed = ratingSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid request.')
    }

    // Use server client so RLS enforces guest_user_id = auth.uid()
    const supabase = await createSupabaseServerClient()

    const { data: existing } = await supabase
      .from('submissions')
      .select('id, guest_user_id')
      .eq('id', submissionId)
      .is('deleted_at', null)
      .single<{ id: string; guest_user_id: string }>()

    if (!existing) throw new NotFoundError('Submission')

    // Guests can only rate submissions they uploaded
    if (existing.guest_user_id !== userId) {
      throw new NotFoundError('Submission')
    }

    const { error } = await supabase
      .from('submissions')
      .update({ rating: parsed.data.rating })
      .eq('id', submissionId)
      .eq('guest_user_id', userId)

    if (error) {
      return Response.json({ error: 'Something went wrong.' }, { status: 500 })
    }

    return Response.json({ ok: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
