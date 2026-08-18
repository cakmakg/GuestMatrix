import type { NextRequest } from 'next/server'

import {
  AuthorizationError,
  handleRouteError,
  NotFoundError,
  ValidationError,
} from '@/lib/auth/errors'
import { requireTenantAuth } from '@/lib/auth/session'
import { resolveDashboardCapabilities } from '@/lib/sectors'
import { applyDateRange, reportFilterSchema } from '@/lib/dashboard/report-filters'
import { resolveQuestionCatalog } from '@/lib/dashboard/feedback-summary'
import { buildExportFilename, buildTenantFeedbackCsv, type TenantExportRow } from '@/lib/export/csv'
import { createSupabaseServerClient } from '@/lib/supabase/server'

type TenantRow = { sector: string; business_type: string | null }
type EventRow = { id: string; name: string }

/**
 * Kampagnenübergreifender Bericht-Export des Tenants — das Gegenstück zum Einzel-Export
 * (app/api/events/[eventId]/export/route.ts), nur über den gesamten Bestand plus Zeitraum.
 *
 * Wie dort läuft der Zugriff RLS-aktiv (tenant_select_own_events / tenant_select_submissions);
 * die zusätzlichen tenant_id-Filter sind Defense-in-Depth. Kein service_role.
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const { tenantId } = await requireTenantAuth()

    // Anders als die Seite (die per .catch() auf den Gesamtzeitraum zurückfällt) ist die Route
    // streng: ein kaputter Parameter soll hier keine stillschweigend andere Datei liefern.
    const parsed = reportFilterSchema.safeParse({
      from: request.nextUrl.searchParams.get('from') ?? undefined,
      to: request.nextUrl.searchParams.get('to') ?? undefined,
    })
    if (!parsed.success) throw new ValidationError('Invalid date range.')

    const filters = parsed.data
    const supabase = await createSupabaseServerClient()

    const { data: tenant } = await supabase
      .from('tenants')
      .select('sector, business_type')
      .single<TenantRow>()

    // Der Export ist ein Betriebswerkzeug; Flow-Modi ohne Auswertung (Gästebuch) bieten ihn nicht
    // an. Die Oberfläche blendet ihn bereits aus — diese Prüfung gilt dem direkten Aufruf.
    if (!resolveDashboardCapabilities(tenant?.sector, tenant?.business_type).exportEnabled) {
      throw new AuthorizationError('Export is not available for this account.')
    }

    const { data: eventsData } = await supabase
      .from('events')
      .select('id, name')
      .eq('tenant_id', tenantId)

    const { data, error } = await supabase
      .from('submissions')
      .select(
        'id, event_id, media_url, file_type, guest_name, uploaded_at, deleted_at, moderation_flag, resolved_at, rating, comment, feedback_answers',
      )
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .not('uploaded_at', 'is', null)
      .order('uploaded_at', { ascending: false })

    if (error) throw new NotFoundError('Submissions')

    const submissions = (data as TenantExportRow[]) ?? []
    const events = (eventsData as EventRow[]) ?? []
    const eventNameById = new Map(events.map((event) => [event.id, event.name]))

    // Der Zeitraum wird mit derselben reinen Funktion angewandt wie auf der Berichtsseite —
    // Bildschirm und Datei zeigen denselben Ausschnitt.
    const inRange = applyDateRange(
      submissions.map((s) => ({ ...s, uploadedAt: s.uploaded_at })),
      filters,
    )

    // Der Fragenkatalog kommt aus der Registry, abgeleitet aus (sector, business_type).
    const questions = resolveQuestionCatalog(tenant?.sector, tenant?.business_type)

    const csv = buildTenantFeedbackCsv(inRange, questions, eventNameById)
    const filename = buildExportFilename('bericht', filters.from ?? 'gesamt')

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
