import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import QRCode from 'qrcode'

import { requireTenantAuth, requireEventOwnership } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createSignedUrls, SIGNED_URL_EXPIRY } from '@/lib/storage/signed-url'

import { deleteFromDashboardAction, moderateAction } from './actions'
import QrSection from './QrSection'

type SubmissionRow = {
  id: string
  media_url: string | null
  file_type: 'image' | 'video'
  uploaded_at: string | null
  moderation_flag: boolean
  rating: number | null
}

async function getEventData(tenantId: string, eventId: string) {
  const { data: event } = await supabaseAdmin
    .from('events')
    .select('id, name, date, description, tenant_id')
    .eq('id', eventId)
    .eq('tenant_id', tenantId)
    .single<{
      id: string
      name: string
      date: string
      description: string | null
      tenant_id: string
    }>()

  if (!event) return null

  const { data } = await supabaseAdmin
    .from('submissions')
    .select('id, media_url, file_type, uploaded_at, moderation_flag, rating')
    .eq('event_id', eventId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .not('uploaded_at', 'is', null)
    .order('uploaded_at', { ascending: false })

  const submissions = (data as SubmissionRow[]) ?? []

  const paths = submissions.map((s) => s.media_url).filter((p): p is string => p !== null)
  const signedUrlMap = await createSignedUrls(paths, SIGNED_URL_EXPIRY.gallery)

  const items = submissions.map((s) => ({
    ...s,
    signedUrl: s.media_url ? (signedUrlMap.get(s.media_url) ?? null) : null,
  }))

  const ratings = submissions.map((s) => s.rating).filter((r): r is number => r !== null)
  const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null

  return { event, submissions: items, avgRating }
}

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>
  searchParams: Promise<{ created?: string }>
}) {
  const { eventId } = await params
  const { created } = await searchParams

  let tenantId: string
  try {
    const session = await requireTenantAuth()
    tenantId = session.tenantId
    await requireEventOwnership(tenantId, eventId)
  } catch {
    redirect('/login')
  }

  const result = await getEventData(tenantId, eventId)
  if (!result) notFound()

  const { event, submissions, avgRating } = result

  const guestUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/e/${eventId}`
  const qrDataUrl = await QRCode.toDataURL(guestUrl, { width: 300, margin: 2 })

  const flagged = submissions.filter((s) => s.moderation_flag).length
  const visible = submissions.length - flagged

  return (
    <div className="p-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600">
          ← Übersicht
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">{event.name}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {new Date(event.date).toLocaleDateString('de-DE', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </div>

      {created && (
        <div className="mb-6 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          ✅ Event erstellt! Teile den QR-Code mit deinen Gästen.
        </div>
      )}

      <div className="grid grid-cols-3 gap-6 mb-8">
        {/* Stats */}
        <div className="col-span-2 grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-5 border border-gray-200">
            <p className="text-sm text-gray-500">Uploads</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{submissions.length}</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-200">
            <p className="text-sm text-gray-500">Sichtbar</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{visible}</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-200">
            <p className="text-sm text-gray-500">Ø Bewertung</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              {avgRating !== null ? avgRating.toFixed(1) : '—'}
            </p>
          </div>
        </div>

        {/* QR Code */}
        <QrSection qrDataUrl={qrDataUrl} guestUrl={guestUrl} />
      </div>

      {/* Submission grid */}
      {submissions.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <p className="text-gray-400">Noch keine Uploads für dieses Event.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <p className="font-medium text-gray-800">Beiträge ({submissions.length})</p>
            <p className="text-sm text-gray-400">{flagged} markiert</p>
          </div>
          <div className="grid grid-cols-4 gap-3 p-4">
            {submissions.map((sub) => (
              <div key={sub.id} className="relative group">
                {/* Media thumbnail */}
                <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 relative">
                  {sub.signedUrl ? (
                    sub.file_type === 'image' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={sub.signedUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <video
                        src={sub.signedUrl}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                      />
                    )
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">
                      {sub.file_type === 'video' ? '🎬' : '🖼️'}
                    </div>
                  )}

                  {sub.moderation_flag && (
                    <div className="absolute inset-0 bg-red-500/30 flex items-center justify-center">
                      <span className="text-white text-xs font-bold bg-red-500 px-2 py-0.5 rounded">
                        Gesperrt
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-1.5 flex gap-1">
                  <form
                    action={async () => {
                      'use server'
                      await moderateAction(sub.id, !sub.moderation_flag)
                    }}
                    className="flex-1"
                  >
                    <button
                      type="submit"
                      className={`w-full text-xs py-1 rounded transition-colors ${
                        sub.moderation_flag
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                      }`}
                    >
                      {sub.moderation_flag ? 'Freigeben' : 'Sperren'}
                    </button>
                  </form>
                  <form
                    action={async () => {
                      'use server'
                      await deleteFromDashboardAction(sub.id)
                    }}
                  >
                    <button
                      type="submit"
                      className="text-xs py-1 px-2 bg-red-100 text-red-600 rounded
                                 hover:bg-red-200 transition-colors"
                    >
                      🗑
                    </button>
                  </form>
                </div>

                {sub.rating !== null && (
                  <p className="text-xs text-gray-400 mt-0.5 text-center">
                    {'★'.repeat(sub.rating)}
                    {'☆'.repeat(5 - sub.rating)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
