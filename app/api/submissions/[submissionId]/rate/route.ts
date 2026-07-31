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
    await requireAnyAuth()

    const body: unknown = await request.json().catch(() => null)
    const parsed = ratingSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid request.')
    }

    // Server client so RLS enforces guest_user_id = auth.uid().
    const supabase = await createSupabaseServerClient()

    // Bewertung ownership-geprüft über die RPC anhängen. WICHTIG (Bugfix): ein direktes update()
    // als Gast trifft 0 Zeilen, weil Gäste keine UPDATE-RLS-Policy auf submissions haben (nur
    // tenant_update_submissions) — die Tour-Bewertung ging still verloren. attach_feedback
    // (SECURITY DEFINER) prüft guest_user_id = auth.uid() und setzt NUR rating/comment/answers.
    // Dieser Pfad ist tour-only (gallery); tour hat weder Kommentar noch strukturierte Antworten.
    const { data: attachedId, error } = await supabase.rpc('attach_feedback', {
      p_submission_id: submissionId,
      p_rating: parsed.data.rating,
    })
    if (error) throw error
    if (!attachedId) throw new NotFoundError('Submission')

    return Response.json({ ok: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
