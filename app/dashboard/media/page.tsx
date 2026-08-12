import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { requireTenantAuth } from '@/lib/auth/session'
import { BRAND } from '@/lib/brand'
import {
  applyMediaFilters,
  hasActiveMediaFilters,
  mediaKind,
  parseMediaFilters,
  sortMedia,
} from '@/lib/dashboard/media-filters'
import { formatNumber, formatRelative } from '@/lib/dashboard/metrics'
import { SIGNED_URL_EXPIRY, createSignedUrls } from '@/lib/storage/signed-url'
import { createSupabaseServerClient } from '@/lib/supabase/server'

import { moderateAction } from '../actions'

export const metadata: Metadata = { title: `Medien – ${BRAND.name}` }

type EventRow = { id: string; name: string }
type SubmissionRow = {
  id: string
  event_id: string
  media_url: string | null
  file_type: string | null
  guest_name: string | null
  comment: string | null
  moderation_flag: boolean
  uploaded_at: string | null
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const MUTED = 'color-mix(in srgb, var(--color-text) 55%, transparent)'

const KIND_LABELS: Record<string, string> = {
  all: 'Fotos und Videos',
  photo: 'Nur Fotos',
  video: 'Nur Videos',
}
const STATE_LABELS: Record<string, string> = {
  all: 'Alle',
  released: 'Nur freigegeben',
  blocked: 'Nur gesperrt',
}
const SORT_LABELS: Record<string, string> = {
  recent: 'Neueste zuerst',
  oldest: 'Älteste zuerst',
}

const SELECT_STYLE: React.CSSProperties = {
  minHeight: 34,
  padding: '5px 8px',
  font: 'inherit',
  fontSize: 13,
  color: 'var(--color-text)',
  background: 'var(--color-bg)',
  border: '1px solid var(--color-divider)',
}

function Field({
  label,
  name,
  value,
  options,
}: {
  label: string
  name: string
  value: string
  options: { value: string; label: string }[]
}): React.ReactElement {
  const id = `mediafilter-${name}`
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <label
        htmlFor={id}
        style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: MUTED }}
      >
        {label}
      </label>
      <select id={id} name={name} defaultValue={value} style={SELECT_STYLE}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export default async function MediaPage({ searchParams }: Props) {
  let tenantId: string
  try {
    const session = await requireTenantAuth()
    tenantId = session.tenantId
  } catch {
    redirect('/login')
  }

  const filters = parseMediaFilters(await searchParams)
  const supabase = await createSupabaseServerClient()

  const { data: eventsData } = await supabase
    .from('events')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .order('date', { ascending: false })

  const { data: subsData } = await supabase
    .from('submissions')
    .select('id, event_id, media_url, file_type, guest_name, comment, moderation_flag, uploaded_at')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .not('uploaded_at', 'is', null)
    .not('media_url', 'is', null)

  const events = (eventsData as EventRow[]) ?? []
  const subs = (subsData as SubmissionRow[]) ?? []
  const eventNameById = new Map(events.map((event) => [event.id, event.name]))

  const rows = subs.map((sub) => ({
    id: sub.id,
    eventId: sub.event_id,
    mediaUrl: sub.media_url,
    fileType: sub.file_type,
    guestName: sub.guest_name,
    comment: sub.comment,
    blocked: sub.moderation_flag,
    uploadedAt: sub.uploaded_at,
  }))

  const visible = sortMedia(applyMediaFilters(rows, filters), filters.sort)

  // Nur die sichtbaren Pfade signieren — eine Bibliothek mit 2.000 Dateien soll nicht bei
  // jedem Aufruf 2.000 URLs erzeugen, wenn ein Filter davon 12 übrig lässt.
  const paths = visible.map((row) => row.mediaUrl).filter((p): p is string => p !== null)
  const signedUrls = await createSignedUrls(paths, SIGNED_URL_EXPIRY.gallery)

  const blockedTotal = rows.filter((row) => row.blocked).length
  const now = Date.now()

  return (
    <div
      style={{
        padding: '28px 32px 40px',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        minWidth: 0,
      }}
    >
      <div className="gs-rise" data-i="0">
        <div
          style={{
            fontSize: 10,
            letterSpacing: '.12em',
            textTransform: 'uppercase',
            color: 'var(--color-accent)',
            marginBottom: 6,
          }}
        >
          Medien
        </div>
        <h1 style={{ fontSize: 40, margin: '0 0 6px', letterSpacing: '-0.02em' }}>Gästeinhalte</h1>
        <div
          style={{
            fontSize: 14,
            color: 'color-mix(in srgb, var(--color-text) 65%, transparent)',
            maxWidth: 640,
          }}
        >
          {rows.length === 0
            ? 'Sobald Gäste Fotos oder Videos hochladen, sammeln sie sich hier — kampagnenübergreifend.'
            : `${formatNumber(rows.length)} Dateien aus ${formatNumber(events.length)} Kampagnen · ${formatNumber(blockedTotal)} gesperrt.`}
        </div>
      </div>

      {/* ═══ Filter (GET, ohne Client-JavaScript) ═══ */}
      <form
        method="GET"
        className="gs-panel gs-rise"
        data-i="1"
        style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 14 }}
      >
        <Field
          label="Kampagne"
          name="campaign"
          value={filters.campaign ?? 'all'}
          options={[
            { value: 'all', label: 'Alle Kampagnen' },
            ...events.map((event) => ({ value: event.id, label: event.name })),
          ]}
        />
        <Field
          label="Art"
          name="kind"
          value={filters.kind}
          options={Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <Field
          label="Freigabe"
          name="state"
          value={filters.state}
          options={Object.entries(STATE_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <Field
          label="Sortierung"
          name="sort"
          value={filters.sort}
          options={Object.entries(SORT_LABELS).map(([value, label]) => ({ value, label }))}
        />

        <button className="btn btn-primary" type="submit">
          Anwenden
        </button>

        {hasActiveMediaFilters(filters) && (
          <Link className="btn btn-secondary" href="/dashboard/media">
            Zurücksetzen
          </Link>
        )}
      </form>

      {/* ═══ Raster ═══ */}
      <section className="gs-panel gs-rise" data-i="2">
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <h3 style={{ fontSize: 20, margin: 0 }}>
            {formatNumber(visible.length)} {visible.length === 1 ? 'Datei' : 'Dateien'}
          </h3>
          {visible.length !== rows.length && (
            <span style={{ fontSize: 12, color: MUTED }}>
              gefiltert aus {formatNumber(rows.length)}
            </span>
          )}
        </div>

        {visible.length === 0 ? (
          <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>
            {rows.length === 0 ? 'Noch keine Medien.' : 'Keine Datei passt zu diesen Filtern.'}
          </p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
              gap: 16,
            }}
          >
            {visible.map((row) => {
              const url = row.mediaUrl ? (signedUrls.get(row.mediaUrl) ?? null) : null
              const kind = mediaKind(row.fileType)

              return (
                <figure
                  key={row.id}
                  style={{
                    margin: 0,
                    border: '1px solid var(--color-divider)',
                    background: 'var(--color-bg)',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div
                    style={{
                      position: 'relative',
                      aspectRatio: '4 / 3',
                      background: 'var(--color-neutral-200)',
                      overflow: 'hidden',
                    }}
                  >
                    {url === null ? (
                      <div
                        style={{
                          height: '100%',
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: 12,
                          color: MUTED,
                          padding: 12,
                          textAlign: 'center',
                        }}
                      >
                        Vorschau nicht verfügbar
                      </div>
                    ) : kind === 'video' ? (
                      <video
                        src={url}
                        controls
                        preload="metadata"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      /* Bewusst <img>: die Quelle ist eine signierte Storage-URL, die nach
                         SIGNED_URL_EXPIRY.gallery abläuft. next/image würde sie über den
                         Optimizer spiegeln und damit über ihre Gültigkeit hinaus cachen. */
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={url}
                        alt={row.comment?.trim() || 'Gästebeitrag'}
                        loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    )}

                    {row.blocked && (
                      <span
                        className="tag tag-outline"
                        style={{
                          position: 'absolute',
                          top: 8,
                          left: 8,
                          background: 'var(--color-bg)',
                        }}
                      >
                        Gesperrt
                      </span>
                    )}
                  </div>

                  <figcaption
                    style={{
                      padding: '10px 12px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      flex: 1,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ font: '600 13px/1.3 var(--font-body)' }}>
                        {eventNameById.get(row.eventId) ?? 'Kampagne'}
                      </div>
                      <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                        {row.guestName?.trim() || 'Anonym'} · {formatRelative(row.uploadedAt, now)}
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        marginTop: 'auto',
                        paddingTop: 4,
                      }}
                    >
                      <form
                        action={async () => {
                          'use server'
                          await moderateAction(row.id, !row.blocked)
                        }}
                      >
                        <button
                          type="submit"
                          style={{
                            background: 'none',
                            border: 0,
                            padding: 0,
                            fontSize: 12,
                            color: row.blocked ? 'var(--color-accent)' : MUTED,
                            cursor: 'pointer',
                          }}
                        >
                          {row.blocked ? 'Freigeben' : 'Sperren'}
                        </button>
                      </form>

                      {url && (
                        <a
                          href={url}
                          download
                          style={{ fontSize: 12, color: 'var(--color-accent)' }}
                        >
                          Herunterladen
                        </a>
                      )}

                      <Link
                        href={`/dashboard/events/${row.eventId}`}
                        style={{ fontSize: 12, color: MUTED, marginLeft: 'auto' }}
                      >
                        Detail →
                      </Link>
                    </div>
                  </figcaption>
                </figure>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
