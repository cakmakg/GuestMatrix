import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getCampaignConfig, isCampaignType } from '@/lib/sectors'
import { requireTenantAuth } from '@/lib/auth/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'

import { setEventArchivedAction } from './actions'

type EventRow = {
  id: string
  name: string
  date: string
  description: string | null
  campaign_type: string
  flow_mode: string
  archived_at: string | null
  created_at: string
}

type SubmissionStats = {
  count: number
  avgRating: number | null
}

function campaignLabel(campaignType: string): string {
  return isCampaignType(campaignType)
    ? (getCampaignConfig(campaignType)?.label ?? campaignType)
    : campaignType
}

async function getStats(tenantId: string) {
  // RLS-aktiver Server-Client: Tenant-Isolierung wird in der DB durchgesetzt
  // (tenant_select_own_events / tenant_select_submissions). Der service_role-Admin-Client
  // wird für Frontend-Datenlesungen bewusst NICHT verwendet. Die .eq('tenant_id')-Filter
  // bleiben als Defense-in-Depth über RLS.
  const supabase = await createSupabaseServerClient()

  const { data: events } = await supabase
    .from('events')
    .select('id, name, date, description, campaign_type, flow_mode, archived_at, created_at')
    .eq('tenant_id', tenantId)
    .order('date', { ascending: false })

  const eventList = (events as EventRow[]) ?? []

  const { data: subs } = await supabase
    .from('submissions')
    .select('event_id, rating')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .not('uploaded_at', 'is', null)

  const subsData = (subs as { event_id: string; rating: number | null }[]) ?? []

  // Build per-event stats
  const statsByEvent = new Map<string, SubmissionStats>()
  for (const row of subsData) {
    const existing = statsByEvent.get(row.event_id) ?? { count: 0, avgRating: null }
    existing.count += 1
    statsByEvent.set(row.event_id, existing)
  }

  const totalUploads = subsData.length
  const ratings = subsData.map((s) => s.rating).filter((r): r is number => r !== null)
  const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null
  const activeCount = eventList.filter((e) => e.archived_at === null).length

  return { events: eventList, statsByEvent, totalUploads, avgRating, activeCount }
}

export default async function DashboardPage() {
  let tenantId: string
  try {
    const session = await requireTenantAuth()
    tenantId = session.tenantId
  } catch {
    redirect('/login')
  }

  const { events, statsByEvent, totalUploads, avgRating, activeCount } = await getStats(tenantId)

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Übersicht</h1>
        <Link
          href="/dashboard/events/new"
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg
                     hover:bg-indigo-700 transition-colors"
        >
          + Kampagne erstellen
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <p className="text-sm text-gray-500">Aktive Kampagnen</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{activeCount}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <p className="text-sm text-gray-500">Kampagnen gesamt</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{events.length}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <p className="text-sm text-gray-500">Beiträge gesamt</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{totalUploads}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <p className="text-sm text-gray-500">Ø Bewertung</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">
            {avgRating !== null ? avgRating.toFixed(1) : '—'}
          </p>
        </div>
      </div>

      {/* Event List */}
      {events.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <p className="text-gray-400 mb-4">Noch keine Kampagnen. Erstelle deine erste!</p>
          <Link
            href="/dashboard/events/new"
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg
                       hover:bg-indigo-700 transition-colors"
          >
            + Kampagne erstellen
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Kampagne</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Typ</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Datum</th>
                <th className="text-right px-5 py-3 text-gray-500 font-medium">Beiträge</th>
                <th className="text-right px-5 py-3 text-gray-500 font-medium"></th>
                <th className="text-right px-5 py-3 text-gray-500 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {events.map((event) => {
                const stats = statsByEvent.get(event.id) ?? { count: 0, avgRating: null }
                const isArchived = event.archived_at !== null
                return (
                  <tr key={event.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {event.name}
                      {isArchived && (
                        <span className="ml-2 text-xs text-gray-400 font-normal">(archiviert)</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-indigo-50 text-indigo-700">
                        {campaignLabel(event.campaign_type)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {new Date(event.date).toLocaleDateString('de-DE')}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-700">{stats.count}</td>
                    <td className="px-5 py-3 text-right">
                      <form
                        action={async () => {
                          'use server'
                          await setEventArchivedAction(event.id, !isArchived)
                        }}
                      >
                        <button
                          type="submit"
                          className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                        >
                          {isArchived ? 'Reaktivieren' : 'Archivieren'}
                        </button>
                      </form>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/dashboard/events/${event.id}`}
                        className="text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        Ansehen →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
