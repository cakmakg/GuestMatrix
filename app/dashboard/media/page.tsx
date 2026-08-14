import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { requireTenantAuth } from '@/lib/auth/session'
import { BRAND } from '@/lib/brand'
import { countContributors, formatAlbumDate } from '@/lib/dashboard/album'
import {
  applyMediaFilters,
  hasActiveMediaFilters,
  mediaKind,
  parseMediaFilters,
  sortMedia,
} from '@/lib/dashboard/media-filters'
import { formatNumber, formatRelative } from '@/lib/dashboard/metrics'
import { SIGNED_URL_EXPIRY, createSignedUrls } from '@/lib/storage/signed-url'
import { resolveDashboardCapabilities, resolveDashboardLabels } from '@/lib/sectors'
import { createSupabaseServerClient } from '@/lib/supabase/server'

import { deleteFromDashboardAction, moderateAction } from '../actions'
import { ConfirmSubmit } from '../ConfirmSubmit'
import { AlbumGallery, type AlbumItem } from './AlbumGallery'

export const metadata: Metadata = { title: `Medien – ${BRAND.name}` }

type EventRow = { id: string; name: string; date: string | null }
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

const ICON_CALENDAR = (
  <svg viewBox="0 0 24 24">
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M8 3v4M16 3v4M3 10h18" />
  </svg>
)

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

  // Wie dieser Tenant seine Medien nennt — ein Brautpaar sammelt „Fotos & Videos", kein „Medien".
  const { data: tenant } = await supabase
    .from('tenants')
    .select('sector, business_type')
    .single<{ sector: string; business_type: string | null }>()
  const labels = resolveDashboardLabels(tenant?.sector, tenant?.business_type)
  const can = resolveDashboardCapabilities(tenant?.sector, tenant?.business_type)

  const { data: eventsData } = await supabase
    .from('events')
    .select('id, name, date')
    .eq('tenant_id', tenantId)
    .order('date', { ascending: false })

  // Im Sammel-Flow ist dieser Bildschirm die „Galerie" und zeigt ALLES, was die Gäste dagelassen
  // haben — auch einen Gruß ohne Foto. In der reinen Medien-Bibliothek (Hotel/Agentur) bleibt es
  // bei Dateien; ein Feedback ohne Anhang gehört dort in die Antwortliste, nicht hierher.
  const query = supabase
    .from('submissions')
    .select('id, event_id, media_url, file_type, guest_name, comment, moderation_flag, uploaded_at')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .not('uploaded_at', 'is', null)

  const { data: subsData } = can.contributionCentric
    ? await query
    : await query.not('media_url', 'is', null)

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
    hasMedia: sub.media_url !== null,
  }))

  const visible = sortMedia(applyMediaFilters(rows, filters), filters.sort)

  // Nur die sichtbaren Pfade signieren — eine Bibliothek mit 2.000 Dateien soll nicht bei
  // jedem Aufruf 2.000 URLs erzeugen, wenn ein Filter davon 12 übrig lässt.
  const paths = visible.map((row) => row.mediaUrl).filter((p): p is string => p !== null)
  const signedUrls = await createSignedUrls(paths, SIGNED_URL_EXPIRY.gallery)

  const blockedTotal = rows.filter((row) => row.blocked).length
  const now = Date.now()

  // ═══ Album (beitragszentriert) ═══
  //
  // Eigener Rückgabezweig statt Verzweigungen im gemeinsamen Baum: die beiden Ansichten teilen
  // die Daten, aber keine Form. Als Ternär-Kette in einem Baum wurde jede Zeile zur Fallfrage
  // („Beiträge" oder „Dateien"?) — und die eigentliche Aussage, dass hier ein Album und dort
  // eine Bibliothek steht, war nirgends zu lesen.
  if (can.contributionCentric) {
    const single = events.length === 1 ? events[0] : undefined
    const contributors = countContributors(rows)
    const greetings = rows.filter((row) => !row.hasMedia).length

    const albumItems: AlbumItem[] = visible.map((row) => ({
      id: row.id,
      url: row.mediaUrl ? (signedUrls.get(row.mediaUrl) ?? null) : null,
      kind: mediaKind(row.fileType),
      hasMedia: row.hasMedia,
      guestName: row.guestName,
      comment: row.comment,
      blocked: row.blocked,
      uploadedAt: row.uploadedAt,
      // Bei genau einer Feier stünde in jeder Zeile derselbe Name.
      eventName: single ? null : (eventNameById.get(row.eventId) ?? null),
    }))

    const albumDate = single ? formatAlbumDate(single.date) : ''
    const countWord = rows.length === 1 ? labels.response : labels.responses
    // „87 Glückwünsche von 34 Gästen" ist EIN Gedanke und bleibt deshalb ein Satzteil; die
    // Gästezahl mit einem Mittelpunkt abzutrennen las sich wie zwei getrennte Kennzahlen.
    const collected =
      contributors > 0
        ? `${formatNumber(rows.length)} ${countWord} von ${formatNumber(contributors)} ${contributors === 1 ? 'Gast' : 'Gästen'}`
        : `${formatNumber(rows.length)} ${countWord}`

    return (
      <div className="gs-page">
        <header className="gs-album-head gs-rise" data-i="0">
          <h1 className="gs-album-title">{single ? single.name : labels.media}</h1>
          {rows.length > 0 && (
            <p className="gs-album-meta">
              {albumDate !== '' && (
                <span>
                  <span className="gs-icn" aria-hidden="true">
                    {ICON_CALENDAR}
                  </span>
                  {albumDate}
                </span>
              )}
              <span>{collected}</span>
              {blockedTotal > 0 && <span>{formatNumber(blockedTotal)} ausgeblendet</span>}
            </p>
          )}
        </header>

        {/* Der Schalter erscheint nur, wenn es wirklich zwei Sorten zu trennen gibt — bei einer
            Feier ganz ohne textlose Fotos (oder ganz ohne reine Grüße) wäre er eine Zierde, die
            nichts tut. */}
        {greetings > 0 && greetings < rows.length && (
          <nav className="gs-rise" data-i="1" aria-label="Ansicht">
            <span className="gs-segmented">
              <Link
                href="/dashboard/media"
                aria-current={filters.kind === 'all' ? 'true' : undefined}
              >
                Alles
              </Link>
              <Link
                href="/dashboard/media?kind=greeting"
                aria-current={filters.kind === 'greeting' ? 'true' : undefined}
              >
                Nur Grüße
              </Link>
            </span>
          </nav>
        )}

        <AlbumGallery
          items={albumItems}
          emptyText={
            rows.length === 0
              ? 'Sobald deine Gäste den QR-Code scannen, sammeln sich ihre Grüße und Fotos hier.'
              : 'Zu dieser Ansicht gibt es nichts.'
          }
        />
      </div>
    )
  }

  // ═══ Medien-Bibliothek (Hotel/Agentur) ═══
  return (
    <div className="gs-page">
      <div className="gs-page-head gs-rise" data-i="0">
        <div>
          <div className="gs-kicker">{labels.media}</div>
          <h1>Gästeinhalte</h1>
          <div className="gs-page-lead">
            {rows.length === 0
              ? 'Sobald Gäste Fotos oder Videos hochladen, sammeln sie sich hier — kampagnenübergreifend.'
              : `${formatNumber(rows.length)} Dateien aus ${formatNumber(events.length)} Kampagnen · ${formatNumber(blockedTotal)} gesperrt.`}
          </div>
        </div>
      </div>

      {/* ═══ Filter ═══
          Betriebs-Bibliothek: hier lohnen die vollen Filter (Kampagne, Freigabe, Sortierung). */}
      <form method="GET" className="gs-panel gs-filters gs-rise" data-i="1">
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
                      <form
                        action={async () => {
                          'use server'
                          await deleteFromDashboardAction(row.id)
                        }}
                      >
                        <ConfirmSubmit
                          confirmMessage="Diese Datei endgültig löschen? Die Medien werden unwiderruflich entfernt."
                          style={{
                            background: 'none',
                            border: 0,
                            padding: 0,
                            font: 'inherit',
                            fontSize: 12,
                            color: 'var(--color-accent)',
                            cursor: 'pointer',
                          }}
                        >
                          Löschen
                        </ConfirmSubmit>
                      </form>

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
