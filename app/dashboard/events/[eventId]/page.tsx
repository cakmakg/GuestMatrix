import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import QRCode from 'qrcode'

import {
  getCampaignConfig,
  getCapabilities,
  getFeedbackQuestions,
  isCampaignType,
  isEventVisibility,
  isFlowMode,
} from '@/lib/sectors'
import { guestUrlFor } from '@/lib/app-url'
import { requireEventOwnership, requireTenantAuth } from '@/lib/auth/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSignedUrls, SIGNED_URL_EXPIRY } from '@/lib/storage/signed-url'

import { deleteFromDashboardAction, moderateAction } from '../../actions'
import { ConfirmSubmit } from '../../ConfirmSubmit'
import { rowCols } from '../../row-cols'
import { EventSettings } from './EventSettings'
import QrSection from './QrSection'

/** Eine Löschung ist endgültig (Storage-Hard-Delete + Soft-Delete) — daher überall dieselbe Rückfrage. */
const DELETE_CONFIRM = 'Diesen Beitrag endgültig löschen? Medien werden unwiderruflich entfernt.'

const MUTED = 'color-mix(in srgb, var(--color-text) 55%, transparent)'

type SubmissionRow = {
  id: string
  media_url: string | null
  file_type: 'image' | 'video' | null
  guest_name: string | null
  uploaded_at: string | null
  moderation_flag: boolean
  rating: number | null
  comment: string | null
  feedback_answers: Record<string, number | string> | null
}

async function getEventData(tenantId: string, eventId: string) {
  // RLS-aktiver Server-Client: Event- und Submission-Lesungen laufen über die Tenant-Policies
  // (tenant_select_own_events / tenant_select_submissions). Kein service_role für Frontend-
  // Datenlesungen. Signierte Storage-URLs werden weiterhin in createSignedUrls gekapselt.
  const supabase = await createSupabaseServerClient()

  const { data: event } = await supabase
    .from('events')
    .select('id, name, date, venue, description, campaign_type, flow_mode, visibility, tenant_id')
    .eq('id', eventId)
    .eq('tenant_id', tenantId)
    .single<{
      id: string
      name: string
      date: string
      venue: string | null
      description: string | null
      campaign_type: string
      flow_mode: string
      visibility: string
      tenant_id: string
    }>()

  if (!event) return null

  const { data } = await supabase
    .from('submissions')
    .select(
      'id, media_url, file_type, guest_name, uploaded_at, moderation_flag, rating, comment, feedback_answers',
    )
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

/** Sperren + Löschen — auf jedem Beitrag, in jedem Flow-Modus. */
function ItemActions({ id, blocked }: { id: string; blocked: boolean }): React.ReactElement {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      <form
        action={async () => {
          'use server'
          await moderateAction(id, !blocked)
        }}
      >
        <button type="submit" className="btn btn-secondary" style={{ padding: '6px 10px' }}>
          {blocked ? 'Freigeben' : 'Sperren'}
        </button>
      </form>
      <form
        action={async () => {
          'use server'
          await deleteFromDashboardAction(id)
        }}
      >
        <ConfirmSubmit
          confirmMessage={DELETE_CONFIRM}
          ariaLabel="Beitrag löschen"
          className="btn btn-ghost"
        >
          Löschen
        </ConfirmSubmit>
      </form>
    </div>
  )
}

function Thumb({
  url,
  fileType,
}: {
  url: string
  fileType: 'image' | 'video' | null
}): React.ReactElement {
  return (
    <div
      style={{
        width: 64,
        height: 64,
        flex: 'none',
        overflow: 'hidden',
        background: 'var(--color-neutral-200)',
        border: '1px solid var(--color-divider)',
      }}
    >
      {fileType === 'video' ? (
        <video
          src={url}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          muted
          playsInline
          preload="metadata"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
    </div>
  )
}

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>
  searchParams: Promise<{ created?: string; saved?: string; error?: string }>
}) {
  const { eventId } = await params
  const { created, saved, error } = await searchParams

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

  const flowMode = isFlowMode(event.flow_mode) ? event.flow_mode : 'gallery'
  const can = getCapabilities(flowMode)
  const typeLabel = isCampaignType(event.campaign_type)
    ? (getCampaignConfig(event.campaign_type)?.label ?? event.campaign_type)
    : event.campaign_type

  // Fragen-Katalog des Kampagnentyps → id-zu-Prompt-Reihenfolge für die Feedback-Anzeige.
  const feedbackQuestions = isCampaignType(event.campaign_type)
    ? getFeedbackQuestions(event.campaign_type)
    : []

  const guestUrl = await guestUrlFor(eventId)
  const qrDataUrl = await QRCode.toDataURL(guestUrl, { width: 300, margin: 2 })

  const flagged = submissions.filter((s) => s.moderation_flag).length
  const commentCount = submissions.filter((s) => s.comment && s.comment.trim() !== '').length
  const mediaCount = submissions.filter((s) => s.media_url).length

  const statCards: { label: string; value: string | number }[] =
    flowMode === 'feedback'
      ? [
          { label: 'Feedback', value: submissions.length },
          { label: 'Kommentare', value: commentCount },
          { label: 'Ø Bewertung', value: avgRating !== null ? avgRating.toFixed(1) : '—' },
        ]
      : flowMode === 'guestbook'
        ? [
            { label: 'Beiträge', value: submissions.length },
            { label: 'Mit Foto/Video', value: mediaCount },
            { label: 'Sichtbar', value: submissions.length - flagged },
          ]
        : [
            { label: 'Uploads', value: submissions.length },
            { label: 'Sichtbar', value: submissions.length - flagged },
            { label: 'Ø Bewertung', value: avgRating !== null ? avgRating.toFixed(1) : '—' },
          ]

  const listTitle =
    flowMode === 'feedback' ? 'Feedback' : flowMode === 'guestbook' ? 'Gästebuch' : 'Beiträge'
  const emptyText =
    flowMode === 'feedback'
      ? 'Noch kein Feedback für diese Kampagne.'
      : flowMode === 'guestbook'
        ? 'Noch keine Einträge im Gästebuch.'
        : 'Noch keine Uploads für diese Kampagne.'

  return (
    <div className="gs-page">
      {/* ═══ Kopf ═══ */}
      <div className="gs-page-head gs-rise" data-i="0">
        <div>
          <Link href="/dashboard" style={{ fontSize: 13, color: MUTED }}>
            ← Übersicht
          </Link>
          <div className="gs-kicker" style={{ marginTop: 10 }}>
            {typeLabel}
          </div>
          <h1>{event.name}</h1>
          <div className="gs-hero-meta">
            <span>
              {new Date(event.date).toLocaleDateString('de-DE', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
            {event.venue && event.venue.trim() !== '' && <span>{event.venue}</span>}
          </div>
        </div>

        {/* Der Export ist ein Betriebswerkzeug — im Gästebuch gibt es ihn nicht. */}
        {can.exportEnabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <a className="btn btn-secondary" href={`/api/events/${eventId}/export`} download>
              ⬇ CSV-Export
            </a>
            <p style={{ fontSize: 11, color: MUTED, maxWidth: 260 }}>
              Medien-Links im Export sind aus Datenschutzgründen nur 1 Stunde gültig.
            </p>
          </div>
        )}
      </div>

      {created && (
        <div
          className="gs-panel gs-rise"
          data-i="1"
          style={{ borderColor: 'var(--color-accent)', padding: '14px 16px' }}
        >
          Kampagne erstellt. Teile den QR-Code mit deinen Gästen.
        </div>
      )}

      {/* ═══ Kennzahlen + QR ═══ */}
      <div className="gs-split gs-rise" data-i="2">
        <div className="gs-hero-stats">
          {statCards.map((card) => (
            <div key={card.label}>
              <div className="gs-hero-stat-value">{card.value}</div>
              <div className="gs-hero-stat-label">{card.label}</div>
            </div>
          ))}
        </div>

        <QrSection qrDataUrl={qrDataUrl} guestUrl={guestUrl} />
      </div>

      {/* ═══ Beiträge ═══ */}
      <section className="gs-panel gs-rise" data-i="3">
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <h3 style={{ fontSize: 20, margin: 0 }}>
            {listTitle} ({submissions.length})
          </h3>
          {flagged > 0 && <span style={{ fontSize: 12, color: MUTED }}>{flagged} gesperrt</span>}
        </div>

        {submissions.length === 0 ? (
          <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>{emptyText}</p>
        ) : flowMode === 'gallery' ? (
          /* ── Medien-Raster (gallery) ─────────────────────────────────────── */
          /* auto-fill statt vier fester Spalten: auf 375px wären das 90px je Kachel. */
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: 14,
            }}
          >
            {submissions.map((sub) => (
              <div key={sub.id} style={{ minWidth: 0 }}>
                <div
                  style={{
                    aspectRatio: '1 / 1',
                    overflow: 'hidden',
                    background: 'var(--color-neutral-200)',
                    border: '1px solid var(--color-divider)',
                    position: 'relative',
                  }}
                >
                  {sub.signedUrl ? (
                    sub.file_type === 'video' ? (
                      <video
                        src={sub.signedUrl}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        muted
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={sub.signedUrl}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    )
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'grid',
                        placeItems: 'center',
                        color: MUTED,
                      }}
                    >
                      {sub.file_type === 'video' ? 'Video' : 'Bild'}
                    </div>
                  )}

                  {sub.moderation_flag && (
                    <span
                      className="tag tag-accent"
                      style={{ position: 'absolute', left: 6, top: 6 }}
                    >
                      Gesperrt
                    </span>
                  )}
                </div>

                <div style={{ marginTop: 8 }}>
                  <ItemActions id={sub.id} blocked={sub.moderation_flag} />
                </div>

                {sub.rating !== null && (
                  <div style={{ fontSize: 12, color: MUTED, marginTop: 6 }}>{sub.rating} / 5</div>
                )}
                {sub.comment && sub.comment.trim() !== '' && (
                  <p style={{ fontSize: 12, marginTop: 4, wordBreak: 'break-word' }}>
                    {sub.comment}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* ── Liste (feedback + guestbook) ────────────────────────────────── */
          <div>
            {submissions.map((sub) => (
              <div
                key={sub.id}
                className="gs-row"
                style={{ ...rowCols('minmax(0, 1fr)'), alignItems: 'start' }}
              >
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', minWidth: 0 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    {/* Im Gästebuch steht der Absender oben — dort ist der Name die Überschrift,
                        nicht das Kleingedruckte. Mit Noten steht die Note vorn. */}
                    {can.guestNameEnabled ? (
                      <div style={{ font: '600 14px/1.3 var(--font-body)' }}>
                        {sub.guest_name && sub.guest_name.trim() !== '' ? sub.guest_name : 'Anonym'}
                      </div>
                    ) : (
                      <div style={{ font: '800 18px/1 var(--font-heading)' }}>
                        {sub.rating !== null ? `${sub.rating} / 5` : '—'}
                      </div>
                    )}

                    {sub.comment && sub.comment.trim() !== '' ? (
                      <p
                        style={{
                          fontSize: 13,
                          marginTop: 4,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {sub.comment}
                      </p>
                    ) : (
                      <p style={{ fontSize: 13, marginTop: 4, color: MUTED }}>Kein Text</p>
                    )}

                    {/* Strukturierte Antworten — Zahlen wie Texte, in Katalog-Reihenfolge. */}
                    {feedbackQuestions.length > 0 && sub.feedback_answers && (
                      <div
                        style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: '2px 14px' }}
                      >
                        {feedbackQuestions.map((q) => {
                          const value = sub.feedback_answers?.[q.id]
                          if (typeof value === 'number') {
                            return (
                              <span key={q.id} style={{ fontSize: 12, color: MUTED }}>
                                {q.prompt}: {value} / 5
                              </span>
                            )
                          }
                          if (typeof value === 'string' && value.trim() !== '') {
                            return (
                              <span key={q.id} style={{ fontSize: 12, color: MUTED }}>
                                {q.prompt}: „{value}“
                              </span>
                            )
                          }
                          return null
                        })}
                      </div>
                    )}

                    {sub.moderation_flag && (
                      <span className="tag tag-accent" style={{ marginTop: 6 }}>
                        Gesperrt
                      </span>
                    )}
                  </div>

                  {sub.signedUrl && <Thumb url={sub.signedUrl} fileType={sub.file_type} />}
                </div>

                <div style={{ marginTop: 8 }}>
                  <ItemActions id={sub.id} blocked={sub.moderation_flag} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ═══ Einstellungen ═══ */}
      <EventSettings
        eventId={eventId}
        name={event.name}
        date={event.date}
        venue={event.venue}
        description={event.description}
        visibility={isEventVisibility(event.visibility) ? event.visibility : 'private'}
        showVisibility={
          isCampaignType(event.campaign_type)
            ? (getCampaignConfig(event.campaign_type)?.allowVisibilityChoice ?? false)
            : false
        }
        saved={saved === '1'}
        error={error}
      />
    </div>
  )
}
