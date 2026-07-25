import Link from 'next/link'
import { redirect } from 'next/navigation'

import { requireTenantAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'

type EventRow = {
  id: string
  name: string
  date: string
  description: string | null
  created_at: string
}

type SubmissionStats = {
  count: number
  avgRating: number | null
}

async function getStats(tenantId: string) {
  const { data: events } = await supabaseAdmin
    .from('events')
    .select('id, name, date, description, created_at')
    .eq('tenant_id', tenantId)
    .order('date', { ascending: false })

  const eventList = (events as EventRow[]) ?? []

  const { data: subs } = await supabaseAdmin
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

  return { events: eventList, statsByEvent, totalUploads, avgRating }
}

export default async function DashboardPage() {
  let tenantId: string
  try {
    const session = await requireTenantAuth()
    tenantId = session.tenantId
  } catch {
    redirect('/login')
  }

  const { events, statsByEvent, totalUploads, avgRating } = await getStats(tenantId)

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Übersicht</h1>
        <Link
          href="/dashboard/events/new"
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg
                     hover:bg-indigo-700 transition-colors"
        >
          + Event erstellen
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <p className="text-sm text-gray-500">Events</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{events.length}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <p className="text-sm text-gray-500">Uploads gesamt</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{totalUploads}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <p className="text-sm text-gray-500">Ø Bewertung</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {avgRating !== null ? avgRating.toFixed(1) : '—'}
          </p>
        </div>
      </div>

      {/* Event List */}
      {events.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <p className="text-gray-400 mb-4">Noch keine Events. Erstelle dein erstes!</p>
          <Link
            href="/dashboard/events/new"
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg
                       hover:bg-indigo-700 transition-colors"
          >
            + Event erstellen
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Event</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Datum</th>
                <th className="text-right px-5 py-3 text-gray-500 font-medium">Uploads</th>
                <th className="text-right px-5 py-3 text-gray-500 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {events.map((event) => {
                const stats = statsByEvent.get(event.id) ?? { count: 0, avgRating: null }
                return (
                  <tr key={event.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900">{event.name}</td>
                    <td className="px-5 py-3 text-gray-500">
                      {new Date(event.date).toLocaleDateString('de-DE')}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-700">{stats.count}</td>
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
