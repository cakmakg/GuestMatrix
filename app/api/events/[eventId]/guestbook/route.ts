import type { NextRequest } from 'next/server'

import { handleRouteError, NotFoundError, ValidationError } from '@/lib/auth/errors'
import { requireAnyAuth } from '@/lib/auth/session'
import { invalidAnswerTypes, isCampaignType, unknownAnswerKeys } from '@/lib/sectors'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { eventIdParam, guestbookMessageSchema } from '@/lib/validation/schemas'

/**
 * Gästebuch-Gruß ohne Medien (Event/Hochzeit, flow_mode = guestbook).
 * Beiträge MIT Foto/Video laufen über presign (guestName + message am Medienbeitrag);
 * diese Route legt einen abgeschlossenen, medienlosen Beitrag mit Name + Glückwunsch an.
 */
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
    const parsed = guestbookMessageSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid request.')
    }
    const { guestName, message, answers } = parsed.data

    // Server client so RLS enforces guest_user_id = auth.uid()
    const supabase = await createSupabaseServerClient()

    // Public RLS policy allows any authenticated user to read events.
    const { data: event } = await supabase
      .from('events')
      .select('id, tenant_id, campaign_type')
      .eq('id', eventId)
      .single<{ id: string; tenant_id: string; campaign_type: string }>()

    if (!event) throw new NotFoundError('Event')

    // Strukturierte Antworten: Schlüssel-Zugehörigkeit UND Wert-Typ gegen den Katalog prüfen
    // (UX / frühe klare Ablehnung). Der DB-Trigger validiert erneut (jsonb ist schemalos).
    if (answers) {
      if (!isCampaignType(event.campaign_type)) {
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

    const now = new Date().toISOString()
    // consent_at is set server-side — the client cannot falsify the timestamp.
    // uploaded_at marks the guestbook entry as complete (no media, but a valid greeting).
    const { data: created, error } = await supabase
      .from('submissions')
      .insert({
        tenant_id: event.tenant_id,
        event_id: eventId,
        guest_user_id: userId,
        guest_name: guestName,
        comment: message,
        // Optionale strukturierte Antworten (z. B. Hochzeit „drei Worte"); der DB-Trigger validiert.
        feedback_answers: answers ?? null,
        consent_at: now,
        uploaded_at: now,
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
