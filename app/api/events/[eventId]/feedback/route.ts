import type { NextRequest } from 'next/server'

import { handleRouteError, NotFoundError, ValidationError } from '@/lib/auth/errors'
import { requireAnyAuth } from '@/lib/auth/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { eventIdParam, feedbackSchema } from '@/lib/validation/schemas'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
): Promise<Response> {
  try {
    const rawParams = await params
    const parsedParams = eventIdParam.safeParse(rawParams)
    if (!parsedParams.success) throw new ValidationError('Invalid event ID.')
    const { eventId } = parsedParams.data

    const { userId } = await requireAnyAuth()

    const body: unknown = await request.json().catch(() => null)
    const parsed = feedbackSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid request.')
    }
    const { rating, comment, submissionId } = parsed.data

    // Server client so RLS enforces guest_user_id = auth.uid()
    const supabase = await createSupabaseServerClient()

    // ── Media already uploaded: attach rating/comment via ownership-checked RPC ──
    // Gäste haben keine UPDATE-RLS-Policy auf submissions; ein direktes update() träfe still
    // 0 Zeilen (rating/comment gingen verloren). attach_feedback (SECURITY DEFINER) prüft
    // guest_user_id = auth.uid() und aktualisiert NUR rating/comment. Kein Treffer =
    // fremde/fehlende Einreichung → NotFoundError.
    if (submissionId) {
      const { data: attachedId, error } = await supabase.rpc('attach_feedback', {
        p_submission_id: submissionId,
        p_rating: rating,
        p_comment: comment,
      })
      if (error) throw error
      if (!attachedId) throw new NotFoundError('Submission')
      return Response.json({ ok: true, submissionId })
    }

    // ── Feedback without media: create a completed, media-less submission ─────────
    // Public RLS policy allows any authenticated user to read events.
    const { data: event } = await supabase
      .from('events')
      .select('id, tenant_id')
      .eq('id', eventId)
      .single<{ id: string; tenant_id: string }>()

    if (!event) throw new NotFoundError('Event')

    const now = new Date().toISOString()
    // consent_at is set server-side — the client cannot falsify the timestamp.
    // uploaded_at marks the feedback as complete (no media, but a valid contribution).
    const { data: created, error } = await supabase
      .from('submissions')
      .insert({
        tenant_id: event.tenant_id,
        event_id: eventId,
        guest_user_id: userId,
        consent_at: now,
        uploaded_at: now,
        rating: rating ?? null,
        comment: comment ?? null,
      })
      .select('id')
      .single<{ id: string }>()

    if (error || !created) {
      return Response.json({ error: 'Something went wrong.' }, { status: 500 })
    }

    return Response.json({ ok: true, submissionId: created.id }, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
