import type { NextRequest } from 'next/server'

import {
  AuthorizationError,
  handleRouteError,
  NotFoundError,
  ValidationError,
} from '@/lib/auth/errors'
import { requireEventOwnership, requireTenantAuth } from '@/lib/auth/session'
import {
  buildEventFeedbackCsv,
  buildExportFilename,
  type ExportSubmissionRow,
} from '@/lib/export/csv'
import { getCapabilities, getFeedbackQuestions, isCampaignType, isFlowMode } from '@/lib/sectors'
import { createSignedUrls, SIGNED_URL_EXPIRY } from '@/lib/storage/signed-url'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { eventIdParam } from '@/lib/validation/schemas'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
): Promise<Response> {
  try {
    const parsed = eventIdParam.safeParse(await params)
    if (!parsed.success) throw new ValidationError('Invalid event ID.')

    const { eventId } = parsed.data
    const { tenantId } = await requireTenantAuth()
    await requireEventOwnership(tenantId, eventId)

    // RLS-aktiver Server-Client: der Export liest ausschließlich über die Tenant-Policies
    // (tenant_select_own_events / tenant_select_submissions) — kein service_role-Tabellenzugriff.
    // Der zusätzliche tenant_id-Filter ist Defense-in-Depth über der RLS. Signierte Storage-URLs
    // bleiben die bewusst gekapselte Ausnahme in lib/storage/signed-url.ts.
    const supabase = await createSupabaseServerClient()

    const { data: event } = await supabase
      .from('events')
      .select('id, name, date, campaign_type, flow_mode')
      .eq('id', eventId)
      .eq('tenant_id', tenantId)
      .single<{
        id: string
        name: string
        date: string
        campaign_type: string
        flow_mode: string
      }>()

    if (!event) throw new NotFoundError('Event')

    // Der Export ist ein Betriebswerkzeug und hängt am Flow-Modus DIESER Kampagne (nicht am
    // Tenant): ein Gästebuch gibt seine Grüße nicht als Tabelle heraus. Die Oberfläche blendet
    // den Knopf bereits aus — diese Prüfung gilt dem direkten Aufruf.
    if (isFlowMode(event.flow_mode) && !getCapabilities(event.flow_mode).exportEnabled) {
      throw new AuthorizationError('Export is not available for this campaign.')
    }

    const { data, error } = await supabase
      .from('submissions')
      .select(
        'id, media_url, file_type, guest_name, uploaded_at, deleted_at, moderation_flag, rating, comment, feedback_answers',
      )
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .not('uploaded_at', 'is', null)
      .order('uploaded_at', { ascending: false })

    if (error) throw new NotFoundError('Submissions')

    const submissions = (data as ExportSubmissionRow[]) ?? []

    // Dimensions-Spalten aus dem Kampagnentyp-Katalog (leer bei tour → nur die Kernspalten).
    const questions = isCampaignType(event.campaign_type)
      ? getFeedbackQuestions(event.campaign_type)
      : []

    const paths = submissions.map((s) => s.media_url).filter((p): p is string => p !== null)
    const signedUrlByPath = await createSignedUrls(paths, SIGNED_URL_EXPIRY.gallery)

    const csv = buildEventFeedbackCsv(submissions, questions, signedUrlByPath)
    const filename = buildExportFilename(event.name, event.date)

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
