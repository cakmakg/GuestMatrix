import type { NextRequest } from 'next/server'

import { handleRouteError, NotFoundError, AuthorizationError } from '@/lib/auth/errors'
import { requireAnyAuth } from '@/lib/auth/session'
import { logger } from '@/lib/logger'
import { checkRateLimit, rateLimiters } from '@/lib/rate-limit'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { eventIdParam } from '@/lib/validation/schemas'

const SIGNED_URL_EXPIRY_SECONDS = 3600 // 1 hour

type GalleryItem = {
  id: string
  media_url: string | null
  file_type: 'image' | 'video'
  uploaded_at: string | null
  comment: string | null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
): Promise<Response> {
  try {
    // ── Rate limit ─────────────────────────────────────────────────────────────
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'
    await checkRateLimit(rateLimiters.gallery, ip)

    // ── Auth ───────────────────────────────────────────────────────────────────
    const { userId } = await requireAnyAuth()

    // ── Param validation ───────────────────────────────────────────────────────
    const parsed = eventIdParam.safeParse(await params)
    if (!parsed.success) throw new NotFoundError('Event')
    const { eventId } = parsed.data

    const supabase = await createSupabaseServerClient()

    // ── Verify event exists ────────────────────────────────────────────────────
    const { data: event } = await supabase
      .from('events')
      .select('id, name')
      .eq('id', eventId)
      .single<{ id: string; name: string }>()

    if (!event) throw new NotFoundError('Event')

    // ── Reciprocity lock — enforced at API level (T3 fix) ─────────────────────
    // A user who has not uploaded at least one file to this event cannot view the gallery.
    const { count } = await supabase
      .from('submissions')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('guest_user_id', userId)
      .not('uploaded_at', 'is', null)
      .is('deleted_at', null)

    if (!count || count === 0) {
      throw new AuthorizationError('Upload a photo or video first to unlock the gallery.')
    }

    // ── Fetch approved gallery items ───────────────────────────────────────────
    const { data: submissions } = await supabase
      .from('submissions')
      .select('id, media_url, file_type, uploaded_at, comment')
      .eq('event_id', eventId)
      .eq('moderation_flag', false)
      .is('deleted_at', null)
      .not('uploaded_at', 'is', null)
      .order('uploaded_at', { ascending: false })
      .returns<GalleryItem[]>()

    if (!submissions?.length) {
      return Response.json({ eventName: event.name, items: [] })
    }

    // ── Generate signed URLs (never expose raw storage paths to the client) ────
    const paths = submissions.map((s) => s.media_url).filter((url): url is string => url !== null)

    const { data: signedUrls, error: signedError } = await supabaseAdmin.storage
      .from('ugc-media')
      .createSignedUrls(paths, SIGNED_URL_EXPIRY_SECONDS)

    if (signedError) {
      logger.error('[gallery] signed URL generation failed', {
        eventId,
        error: signedError.message,
      })
      return Response.json({ error: 'Something went wrong.' }, { status: 500 })
    }

    const urlMap = new Map(signedUrls?.map((s) => [s.path, s.signedUrl]) ?? [])

    const items = submissions
      .filter((s) => s.media_url && urlMap.has(s.media_url))
      .map((s) => ({
        id: s.id,
        mediaUrl: urlMap.get(s.media_url!)!,
        fileType: s.file_type,
        uploadedAt: s.uploaded_at,
        caption: s.comment,
      }))

    return Response.json({ eventName: event.name, items })
  } catch (error) {
    return handleRouteError(error)
  }
}
