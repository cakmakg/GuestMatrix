import type { NextRequest } from 'next/server'

import {
  AuthorizationError,
  handleRouteError,
  NotFoundError,
  ValidationError,
} from '@/lib/auth/errors'
import { requireAnyAuth } from '@/lib/auth/session'
import { getPlanConfig, resolvePlan } from '@/lib/plans'
import { checkRateLimit, rateLimiters } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { presignSchema, MIME_TO_EXT, type AllowedMimeType } from '@/lib/validation/schemas'

const BUCKET = 'ugc-media'

export async function POST(request: NextRequest): Promise<Response> {
  try {
    // ── Rate limit (per authenticated user) ────────────────────────────────────
    const { userId } = await requireAnyAuth()
    await checkRateLimit(rateLimiters.presign, userId)

    // ── Input validation ───────────────────────────────────────────────────────
    const body: unknown = await request.json().catch(() => null)
    const parsed = presignSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid request.'
      throw new ValidationError(message)
    }
    const { eventId, mimeType, guestName, message } = parsed.data

    const supabase = await createSupabaseServerClient()

    // ── Verify event exists and retrieve tenant_id ─────────────────────────────
    // Public RLS policy allows any authenticated user to read events.
    const { data: event } = await supabase
      .from('events')
      .select('id, tenant_id')
      .eq('id', eventId)
      .single<{ id: string; tenant_id: string }>()

    if (!event) throw new NotFoundError('Event')

    // ── Tarif-Kontingent: abgeschlossene Uploads je Event begrenzen ────────────
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('plan')
      .eq('id', event.tenant_id)
      .single<{ plan: string }>()

    const planConfig = getPlanConfig(resolvePlan(tenant?.plan))
    const { count: uploadedCount } = await supabaseAdmin
      .from('submissions')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .not('uploaded_at', 'is', null)
      .is('deleted_at', null)

    if ((uploadedCount ?? 0) >= planConfig.maxUploadsPerEvent) {
      throw new AuthorizationError('Upload-Limit für dieses Event erreicht.')
    }

    // ── Create submission in pending state ─────────────────────────────────────
    // consent_at is set server-side — the client cannot falsify the timestamp.
    const { data: submission, error: insertError } = await supabase
      .from('submissions')
      .insert({
        tenant_id: event.tenant_id,
        event_id: eventId,
        guest_user_id: userId,
        file_type: mimeType.startsWith('image/') ? 'image' : 'video',
        // guestbook: Name + Glückwunsch am Medienbeitrag; sonst null.
        guest_name: guestName ?? null,
        comment: message ?? null,
        consent_at: new Date().toISOString(),
      })
      .select('id')
      .single<{ id: string }>()

    if (insertError || !submission) {
      console.error('[presign] submission insert failed', insertError)
      return Response.json({ error: 'Something went wrong.' }, { status: 500 })
    }

    // ── Build storage path — server-controlled, no client input in path ────────
    const ext = MIME_TO_EXT[mimeType as AllowedMimeType]
    const uniqueFilename = `${crypto.randomUUID()}${ext}`
    const storagePath = `${event.tenant_id}/${eventId}/${submission.id}/${uniqueFilename}`

    // ── Generate presigned upload URL via admin client ─────────────────────────
    const { data: presignData, error: presignError } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUploadUrl(storagePath, { upsert: false })

    if (presignError || !presignData) {
      console.error('[presign] signed URL generation failed', presignError)
      // Clean up the pending submission so it does not litter the DB
      await supabaseAdmin.from('submissions').delete().eq('id', submission.id)
      return Response.json({ error: 'Something went wrong.' }, { status: 500 })
    }

    // ── Store the path on the submission so confirm can locate the file ─────────
    await supabaseAdmin
      .from('submissions')
      .update({ media_url: storagePath })
      .eq('id', submission.id)

    return Response.json(
      {
        presignedUrl: presignData.signedUrl,
        submissionId: submission.id,
      },
      { status: 201 },
    )
  } catch (error) {
    return handleRouteError(error)
  }
}
