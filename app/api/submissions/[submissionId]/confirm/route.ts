import type { NextRequest } from 'next/server'

import { handleRouteError, NotFoundError, AuthorizationError, UploadError } from '@/lib/auth/errors'
import { requireAnyAuth } from '@/lib/auth/session'
import { logger } from '@/lib/logger'
import { validateFileMime } from '@/lib/storage/mime'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { submissionIdParam } from '@/lib/validation/schemas'

const BUCKET = 'ugc-media'
const MIME_CHECK_SIGNED_URL_EXPIRY = 60 // 1 minute — only needed for the magic-byte read

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> },
): Promise<Response> {
  try {
    // ── Auth ───────────────────────────────────────────────────────────────────
    const { userId } = await requireAnyAuth()

    // ── Param validation ───────────────────────────────────────────────────────
    const parsed = submissionIdParam.safeParse(await params)
    if (!parsed.success) throw new NotFoundError('Submission')
    const { submissionId } = parsed.data

    // ── Fetch submission via admin to bypass RLS for the ownership check ────────
    const { data: submission } = await supabaseAdmin
      .from('submissions')
      .select('id, guest_user_id, media_url, uploaded_at, deleted_at')
      .eq('id', submissionId)
      .single()

    if (!submission) throw new NotFoundError('Submission')

    // ── Ownership check ────────────────────────────────────────────────────────
    if (submission.guest_user_id !== userId) throw new AuthorizationError()

    // ── Guard: already confirmed or deleted ────────────────────────────────────
    if (submission.uploaded_at !== null) {
      return Response.json({ error: 'Submission already confirmed.' }, { status: 409 })
    }
    if (submission.deleted_at !== null) {
      return Response.json({ error: 'Submission has been deleted.' }, { status: 410 })
    }
    if (!submission.media_url) {
      return Response.json({ error: 'No file found for this submission.' }, { status: 422 })
    }

    // ── Generate a short-lived URL to read the first bytes for MIME detection ──
    const { data: readUrl, error: readUrlError } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(submission.media_url, MIME_CHECK_SIGNED_URL_EXPIRY)

    if (readUrlError || !readUrl) {
      logger.error('[confirm] could not create signed read URL', {
        submissionId,
        error: readUrlError?.message,
      })
      return Response.json({ error: 'Something went wrong.' }, { status: 500 })
    }

    // ── MIME validation via magic bytes ────────────────────────────────────────
    const mimeResult = await validateFileMime(readUrl.signedUrl)

    if (!mimeResult.valid) {
      // Delete the file and the pending submission — let the user try again
      await Promise.all([
        supabaseAdmin.storage.from(BUCKET).remove([submission.media_url]),
        supabaseAdmin.from('submissions').delete().eq('id', submissionId),
      ])
      throw new UploadError(
        mimeResult.detectedMime
          ? `File type "${mimeResult.detectedMime}" is not allowed.`
          : 'Could not determine file type. Please upload a JPEG, PNG, MP4, or MOV.',
      )
    }

    // ── Mark submission as confirmed ───────────────────────────────────────────
    const { error: updateError } = await supabaseAdmin
      .from('submissions')
      .update({ uploaded_at: new Date().toISOString() })
      .eq('id', submissionId)

    if (updateError) {
      logger.error('[confirm] submission update failed', {
        submissionId,
        error: updateError.message,
      })
      return Response.json({ error: 'Something went wrong.' }, { status: 500 })
    }

    // ── Return a signed URL so the client can immediately preview the file ──────
    const { data: previewUrl } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(submission.media_url, 3600)

    return Response.json({
      submissionId,
      mediaUrl: previewUrl?.signedUrl ?? null,
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
