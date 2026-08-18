import type { NextRequest } from 'next/server'

import { handleRouteError, NotFoundError, ValidationError } from '@/lib/auth/errors'
import { requireAnyAuth } from '@/lib/auth/session'
import { invalidAnswerTypes, isCampaignType, unknownAnswerKeys } from '@/lib/sectors'
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
    const { rating, comment, answers, submissionId, guestName } = parsed.data

    // Server client so RLS enforces guest_user_id = auth.uid()
    const supabase = await createSupabaseServerClient()

    // Event nur laden, wenn nötig: für tenant_id (medienloser Pfad) oder campaign_type
    // (Antwort-Katalog-Prüfung). public_select_events erlaubt jedem Auth-Nutzer das Lesen.
    let event: { id: string; tenant_id: string; campaign_type: string } | null = null
    if (answers || !submissionId) {
      const { data } = await supabase
        .from('events')
        .select('id, tenant_id, campaign_type')
        .eq('id', eventId)
        .single<{ id: string; tenant_id: string; campaign_type: string }>()
      event = data ?? null
      if (!event) throw new NotFoundError('Event')
    }

    // Strukturierte Antworten: Schlüssel gegen den Kampagnen-Katalog prüfen (UX / frühe, klare
    // Ablehnung). Die DB validiert Schlüssel UND Wertebereich zusätzlich (attach_feedback-Körper
    // bzw. Trigger) — die App ist bewusst NICHT die einzige Verteidigungslinie (jsonb ist schemalos).
    if (answers) {
      if (!event || !isCampaignType(event.campaign_type)) {
        throw new ValidationError('Feedback answers are not accepted for this campaign.')
      }
      const unknown = unknownAnswerKeys(event.campaign_type, answers)
      if (unknown.length > 0) {
        throw new ValidationError(`Unknown feedback answer(s): ${unknown.join(', ')}.`)
      }
      const badTypes = invalidAnswerTypes(event.campaign_type, answers)
      if (badTypes.length > 0) {
        throw new ValidationError(`Invalid answer type(s): ${badTypes.join(', ')}.`)
      }
    }

    const answersJson = answers ?? null

    // ── Media already uploaded: attach rating/comment/answers via ownership-checked RPC ──
    // Gäste haben keine UPDATE-RLS-Policy auf submissions; ein direktes update() träfe still
    // 0 Zeilen (die Werte gingen verloren). attach_feedback (SECURITY DEFINER) prüft
    // guest_user_id = auth.uid() und aktualisiert NUR rating/comment/feedback_answers. Kein
    // Treffer = fremde/fehlende Einreichung → NotFoundError.
    if (submissionId) {
      // `guestName` wird hier ABSICHTLICH ignoriert: attach_feedback (SECURITY DEFINER) schreibt
      // nur rating/comment/feedback_answers, und Gäste haben keine UPDATE-Policy auf submissions.
      // Der Name steht auf dieser Zeile bereits — der Medienpfad legt ihn beim presign an (INSERT).
      // Ihn hier zusätzlich anzunehmen würde eine Wirkung vortäuschen, die es nicht gibt.
      const { data: attachedId, error } = await supabase.rpc('attach_feedback', {
        p_submission_id: submissionId,
        p_rating: rating,
        p_comment: comment,
        p_answers: answersJson,
      })
      if (error) throw error
      if (!attachedId) throw new NotFoundError('Submission')
      return Response.json({ ok: true, submissionId })
    }

    // ── Feedback without media: create a completed, media-less submission ─────────
    // event ist hier immer gesetzt (oben geladen, da !submissionId).
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
        feedback_answers: answersJson,
        // Medienlose Rückmeldung: hier entsteht die Zeile, also wird der (freiwillige) Name hier
        // gesetzt. Leer bleibt leer — im Panel steht dann „Anonym", und das ist ein Ergebnis.
        guest_name: guestName ?? null,
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
