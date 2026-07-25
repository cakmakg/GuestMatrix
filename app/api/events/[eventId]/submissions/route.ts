import type { NextRequest } from 'next/server'

import { handleRouteError, NotFoundError, ValidationError } from '@/lib/auth/errors'
import { requireTenantAuth, requireEventOwnership } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createSignedUrls, SIGNED_URL_EXPIRY } from '@/lib/storage/signed-url'
import { eventIdParam } from '@/lib/validation/schemas'

type SubmissionRow = {
  id: string
  media_url: string | null
  file_type: 'image' | 'video'
  uploaded_at: string | null
  moderation_flag: boolean
  rating: number | null
  deleted_at: string | null
  created_at: string
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
): Promise<Response> {
  try {
    const rawParams = await params
    const parsed = eventIdParam.safeParse(rawParams)
    if (!parsed.success) throw new ValidationError('Invalid event ID.')

    const { eventId } = parsed.data
    const { tenantId } = await requireTenantAuth()
    await requireEventOwnership(tenantId, eventId)

    const { data, error } = await supabaseAdmin
      .from('submissions')
      .select(
        'id, media_url, file_type, uploaded_at, moderation_flag, rating, deleted_at, created_at',
      )
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .not('uploaded_at', 'is', null)
      .order('uploaded_at', { ascending: false })

    if (error) throw new NotFoundError('Submissions')

    const submissions = (data as SubmissionRow[]) ?? []

    // Generate signed URLs for all items in one batch call
    const storagePaths = submissions.map((s) => s.media_url).filter((p): p is string => p !== null)
    const signedUrlMap = await createSignedUrls(storagePaths, SIGNED_URL_EXPIRY.gallery)

    const items = submissions.map((s) => ({
      ...s,
      signedUrl: s.media_url ? (signedUrlMap.get(s.media_url) ?? null) : null,
    }))

    return Response.json({ submissions: items })
  } catch (error) {
    return handleRouteError(error)
  }
}
