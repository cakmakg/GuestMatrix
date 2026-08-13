import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { requireTenantAuth } from '@/lib/auth/session'
import { BRAND } from '@/lib/brand'
import {
  applyFeedbackFilters,
  hasActiveFilters,
  parseFeedbackFilters,
  sortFeedback,
} from '@/lib/dashboard/feedback-filters'
import {
  answeredQuestions,
  parseAnswers,
  resolveQuestionCatalog,
} from '@/lib/dashboard/feedback-summary'
import { formatNumber, formatRelative } from '@/lib/dashboard/metrics'
import { resolveDashboardCapabilities, resolveDashboardLabels } from '@/lib/sectors'
import { createSupabaseServerClient } from '@/lib/supabase/server'

import { deleteFromDashboardAction, moderateAction, resolveAction } from '../actions'
import { ConfirmSubmit } from '../ConfirmSubmit'
import { rowCols } from '../row-cols'

export const metadata: Metadata = { title: `Gästeantworten – ${BRAND.name}` }

type TenantRow = { sector: string; business_type: string | null }
type EventRow = { id: string; name: string }
type SubmissionRow = {
  id: string
  event_id: string
  rating: number | null
  comment: string | null
  guest_name: string | null
  media_url: string | null
  moderation_flag: boolean
  feedback_answers: unknown
  uploaded_at: string | null
  resolved_at: string | null
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const MUTED = 'color-mix(in srgb, var(--color-text) 55%, transparent)'

/** Beschriftungen der Filter — die Werte selbst leben im Zod-Enum (feedback-filters.ts). */
const RATING_LABELS: Record<string, string> = {
  all: 'Alle Bewertungen',
  critical: 'Kritisch (≤ 2)',
  neutral: 'Neutral (3)',
  positive: 'Positiv (≥ 4)',
  unrated: 'Ohne Bewertung',
}
const MEDIA_LABELS: Record<string, string> = {
  all: 'Mit und ohne Medien',
  with: 'Nur mit Medien',
  without: 'Nur ohne Medien',
}
const STATE_LABELS: Record<string, string> = {
  all: 'Offen und erledigt',
  open: 'Nur offen',
  resolved: 'Nur erledigt',
}
const SORT_LABELS: Record<string, string> = {
  recent: 'Neueste zuerst',
  lowest: 'Schlechteste zuerst',
  highest: 'Beste zuerst',
}

/** Aktionen sitzen als reine Textknöpfe in der Zeile — wie in der Medien-Bibliothek. */
const ACTION_BUTTON: React.CSSProperties = {
  background: 'none',
  border: 0,
  padding: 0,
  font: 'inherit',
  fontSize: 12,
  cursor: 'pointer',
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
  const id = `filter-${name}`
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <label
        htmlFor={id}
        style={{
          fontSize: 10,
          letterSpacing: '.1em',
          textTransform: 'uppercase',
          color: MUTED,
        }}
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

export default async function FeedbackPage({ searchParams }: Props) {
  let tenantId: string
  try {
    const session = await requireTenantAuth()
    tenantId = session.tenantId
  } catch {
    redirect('/login')
  }

  const filters = parseFeedbackFilters(await searchParams)
  const supabase = await createSupabaseServerClient()

  const { data: tenant } = await supabase
    .from('tenants')
    .select('sector, business_type')
    .single<TenantRow>()

  const { data: eventsData } = await supabase
    .from('events')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .order('date', { ascending: false })

  const { data: subsData } = await supabase
    .from('submissions')
    .select(
      'id, event_id, rating, comment, guest_name, media_url, moderation_flag, feedback_answers, uploaded_at, resolved_at',
    )
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .not('uploaded_at', 'is', null)

  const events = (eventsData as EventRow[]) ?? []
  const subs = (subsData as SubmissionRow[]) ?? []
  const questions = resolveQuestionCatalog(tenant?.sector, tenant?.business_type)
  // Panels aus der Registry: ein Gästebuch kennt keine Noten, dafür einen Absender.
  const can = resolveDashboardCapabilities(tenant?.sector, tenant?.business_type)
  const labels = resolveDashboardLabels(tenant?.sector, tenant?.business_type)
  const eventNameById = new Map(events.map((event) => [event.id, event.name]))

  const rows = subs.map((sub) => ({
    id: sub.id,
    eventId: sub.event_id,
    rating: sub.rating,
    comment: sub.comment,
    guestName: sub.guest_name,
    hasMedia: sub.media_url !== null,
    blocked: sub.moderation_flag,
    answers: parseAnswers(sub.feedback_answers),
    uploadedAt: sub.uploaded_at,
    resolvedAt: sub.resolved_at,
  }))

  const visible = sortFeedback(applyFeedbackFilters(rows, filters), filters.sort)
  const criticalTotal = rows.filter((row) => row.rating !== null && row.rating <= 2).length
  const now = Date.now()

  return (
    <div className="gs-page">
      <div className="gs-page-head gs-rise" data-i="0">
        <div>
          <div className="gs-kicker">{labels.responses}</div>
          <h1>Alle {labels.responses}</h1>
          <div className="gs-page-lead">
            {rows.length === 0
              ? `Sobald Gäste antworten, sammeln sich ihre ${labels.responses} hier — kampagnenübergreifend.`
              : // „kritisch" ist eine Aussage über Noten — ohne Noten wäre sie immer 0 und damit
                // eine Behauptung über etwas, das gar nicht erhoben wurde.
                `${formatNumber(rows.length)} ${labels.responses} aus ${formatNumber(events.length)} ${labels.experiences}${
                  can.ratingEnabled ? ` · ${formatNumber(criticalTotal)} kritisch` : ''
                }.`}
          </div>
        </div>
      </div>

      {/* ═══ Filter (GET, ohne Client-JavaScript) ═══ */}
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
        {/* Ein Bewertungsfilter ohne Bewertungen böte nur Optionen an, die nie etwas treffen. */}
        {can.ratingEnabled && (
          <Field
            label="Bewertung"
            name="rating"
            value={filters.rating}
            options={Object.entries(RATING_LABELS).map(([value, label]) => ({ value, label }))}
          />
        )}
        <Field
          label="Medien"
          name="media"
          value={filters.media}
          options={Object.entries(MEDIA_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <Field
          label="Bearbeitung"
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

        {hasActiveFilters(filters) && (
          <Link className="btn btn-secondary" href="/dashboard/feedback">
            Zurücksetzen
          </Link>
        )}
      </form>

      {/* ═══ Liste ═══ */}
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
            {formatNumber(visible.length)}{' '}
            {visible.length === 1 ? labels.response : labels.responses}
          </h3>
          {visible.length !== rows.length && (
            <span style={{ fontSize: 12, color: MUTED }}>
              gefiltert aus {formatNumber(rows.length)}
            </span>
          )}
        </div>

        {visible.length === 0 ? (
          <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>
            {rows.length === 0
              ? // Genusfrei formuliert: das Label-Set führt kein Geschlecht, „Kein Glückwunsch"
                // und „Keine Rückmeldung" ließen sich daraus nicht beide korrekt bilden.
                `Noch keine ${labels.responses}.`
              : `Nichts passt zu diesen Filtern.`}
          </p>
        ) : (
          <div>
            {visible.map((row) => {
              const answered = answeredQuestions(row.answers, questions)

              return (
                <div
                  key={row.id}
                  className="gs-row"
                  style={{
                    // Ohne Bewertungen entfällt die Noten-Spalte; der Gruß rückt nach vorn.
                    ...rowCols(
                      can.ratingEnabled ? '58px minmax(0, 1fr) 104px' : 'minmax(0, 1fr) 104px',
                    ),
                    alignItems: 'start',
                  }}
                >
                  {/* Note */}
                  {can.ratingEnabled && (
                    <div style={{ textAlign: 'center' }}>
                      <div
                        style={{
                          font: '800 22px/1 var(--font-heading)',
                          fontVariantNumeric: 'tabular-nums',
                          color:
                            row.rating !== null && row.rating <= 2
                              ? 'var(--color-accent)'
                              : 'var(--color-text)',
                        }}
                      >
                        {row.rating ?? '—'}
                      </div>
                      <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                        {row.rating !== null ? '★' : 'ohne'}
                      </div>
                    </div>
                  )}

                  {/* Inhalt */}
                  <div style={{ minWidth: 0 }}>
                    {/* Im Gästebuch ist der Absender die Überschrift, nicht eine Randnotiz. */}
                    {can.guestNameEnabled && (
                      <div style={{ font: '600 14px/1.3 var(--font-body)', marginBottom: 3 }}>
                        {row.guestName && row.guestName.trim() !== '' ? row.guestName : 'Anonym'}
                      </div>
                    )}

                    {row.comment && row.comment.trim() !== '' ? (
                      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45 }}>{row.comment}</p>
                    ) : (
                      <p style={{ margin: 0, fontSize: 14, color: MUTED, fontStyle: 'italic' }}>
                        Kein Kommentar
                      </p>
                    )}

                    <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>
                      {/* Steht der Name schon als Überschrift, wäre er hier eine Dopplung. */}
                      {!can.guestNameEnabled && (
                        <>
                          {row.guestName && row.guestName.trim() !== '' ? row.guestName : 'Anonym'}{' '}
                          ·{' '}
                        </>
                      )}
                      {eventNameById.get(row.eventId) ?? 'Kampagne'} ·{' '}
                      {formatRelative(row.uploadedAt, now)}
                    </div>

                    {answered.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                        {answered.map((question) => (
                          <span key={question.id} className="tag tag-neutral">
                            {question.prompt} {String(row.answers[question.id])}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Merkmale */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: 6,
                    }}
                  >
                    {row.hasMedia && <span className="tag tag-accent">Medien</span>}
                    {row.blocked && <span className="tag tag-outline">Gesperrt</span>}
                    {row.resolvedAt !== null && <span className="tag tag-neutral">Erledigt</span>}
                    <Link
                      href={`/dashboard/events/${row.eventId}`}
                      style={{ fontSize: 12, color: 'var(--color-accent)' }}
                    >
                      Kampagne →
                    </Link>

                    {/* Moderation, Bearbeitungsstand und Löschung greifen auf dieselben Actions zu
                        wie das Kampagnendetail; sie revalidieren /dashboard als Layout, damit
                        Kennzahlen, Medien-Bibliothek und Berichte nicht mit alten Zahlen
                        zurückbleiben. */}
                    <form
                      action={async () => {
                        'use server'
                        await resolveAction(row.id, row.resolvedAt === null)
                      }}
                    >
                      <button type="submit" style={{ ...ACTION_BUTTON, color: MUTED }}>
                        {row.resolvedAt === null ? 'Erledigt' : 'Wieder öffnen'}
                      </button>
                    </form>

                    <form
                      action={async () => {
                        'use server'
                        await moderateAction(row.id, !row.blocked)
                      }}
                    >
                      <button
                        type="submit"
                        style={{
                          ...ACTION_BUTTON,
                          color: row.blocked ? 'var(--color-accent)' : MUTED,
                        }}
                      >
                        {row.blocked ? 'Freigeben' : 'Sperren'}
                      </button>
                    </form>

                    <form
                      action={async () => {
                        'use server'
                        await deleteFromDashboardAction(row.id)
                      }}
                    >
                      <ConfirmSubmit
                        confirmMessage="Diesen Beitrag endgültig löschen? Medien werden unwiderruflich entfernt."
                        style={{ ...ACTION_BUTTON, color: 'var(--color-accent)' }}
                      >
                        Löschen
                      </ConfirmSubmit>
                    </form>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
