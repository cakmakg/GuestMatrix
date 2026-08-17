import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { requireTenantAuth } from '@/lib/auth/session'
import { BRAND } from '@/lib/brand'
import {
  DEFAULT_EXPERIENCE_FILTERS,
  EXPERIENCE_FIRST_DIR,
  applyExperienceFilters,
  hasActiveExperienceFilters,
  parseExperienceFilters,
  sortExperiences,
} from '@/lib/dashboard/experience-filters'
import { buildFilterChips } from '@/lib/dashboard/filter-chips'
import { formatNumber, formatRelative, quotaPercent } from '@/lib/dashboard/metrics'
import { getPlanConfig, resolvePlan } from '@/lib/plans'
import { getCampaignConfig, isCampaignType, resolveDashboardLabels } from '@/lib/sectors'
import { createSupabaseServerClient } from '@/lib/supabase/server'

import { setEventArchivedAction } from '../actions'
import { rowCols } from '../row-cols'
import { SortHeader } from '../SortHeader'

export const metadata: Metadata = { title: `Kampagnen – ${BRAND.name}` }

type TenantRow = { sector: string; business_type: string | null; plan: string }
type EventRow = {
  id: string
  name: string
  date: string
  campaign_type: string
  archived_at: string | null
}
type SubmissionRow = { event_id: string; uploaded_at: string | null }

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const MUTED = 'color-mix(in srgb, var(--color-text) 55%, transparent)'
// Das Datum hat eine eigene Spalte, seit die Kopfzeile sortiert: als Unterzeile beim Namen wäre es
// eine Spalte ohne Überschrift — man könnte nach ihm ordnen, aber nirgends darauf klicken.
const GRID = 'minmax(0, 1fr) 96px 130px 92px 128px 108px'
// 1025–1200px: die Seitenleiste steht noch, sechs Spalten passen aber nicht mehr bequem. Alle
// Festbreiten geben etwas ab, damit der Name nicht auf drei Zeilen bricht; die Handlungsspalte
// nicht, in ihr stehen zwei Beschriftungen nebeneinander.
const GRID_NARROW = 'minmax(0, 1fr) 82px 104px 80px 100px 108px'

/**
 * Auswahlmöglichkeiten der Filter — als Konstanten, weil sie an ZWEI Stellen gebraucht werden:
 * im Formular und als Beschriftung der Chips. Inline im JSX gingen die beiden beim nächsten
 * neuen Wert auseinander, und der Chip zeigte dann den rohen Schlüssel.
 */
const STATE_OPTIONS = [
  { value: 'active', label: 'Nur aktive' },
  { value: 'archived', label: 'Nur archivierte' },
  { value: 'all', label: 'Alle' },
]

const ICON_FILTER = (
  <svg viewBox="0 0 24 24">
    <path d="M3 5h18l-7 8v6l-4 2v-8z" />
  </svg>
)

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
  const id = `expfilter-${name}`
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

export default async function ExperiencesPage({ searchParams }: Props) {
  let tenantId: string
  try {
    const session = await requireTenantAuth()
    tenantId = session.tenantId
  } catch {
    redirect('/login')
  }

  const filters = parseExperienceFilters(await searchParams)
  const supabase = await createSupabaseServerClient()

  const { data: tenant } = await supabase
    .from('tenants')
    .select('sector, business_type, plan')
    .single<TenantRow>()

  const { data: eventsData } = await supabase
    .from('events')
    .select('id, name, date, campaign_type, archived_at')
    .eq('tenant_id', tenantId)
    .order('date', { ascending: false })

  const { data: subsData } = await supabase
    .from('submissions')
    .select('event_id, uploaded_at')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .not('uploaded_at', 'is', null)
    .order('uploaded_at', { ascending: false })

  const events = (eventsData as EventRow[]) ?? []
  const subs = (subsData as SubmissionRow[]) ?? []

  // Benennung kommt aus der Registry — die Seite kennt „Hotel" und „Agentur" nicht.
  const labels = resolveDashboardLabels(tenant?.sector, tenant?.business_type)
  const planConfig = getPlanConfig(resolvePlan(tenant?.plan))

  const responsesByEvent = new Map<string, number>()
  const lastByEvent = new Map<string, string>()
  for (const sub of subs) {
    responsesByEvent.set(sub.event_id, (responsesByEvent.get(sub.event_id) ?? 0) + 1)
    if (sub.uploaded_at && !lastByEvent.has(sub.event_id)) {
      lastByEvent.set(sub.event_id, sub.uploaded_at)
    }
  }

  const rows = events.map((event) => ({
    id: event.id,
    name: event.name,
    date: event.date,
    archived: event.archived_at !== null,
    responses: responsesByEvent.get(event.id) ?? 0,
    lastResponse: lastByEvent.get(event.id) ?? null,
    typeLabel: isCampaignType(event.campaign_type)
      ? (getCampaignConfig(event.campaign_type)?.label ?? event.campaign_type)
      : event.campaign_type,
  }))

  const visible = sortExperiences(applyExperienceFilters(rows, filters), filters.sort, filters.dir)
  const activeCount = rows.filter((row) => !row.archived).length
  const now = Date.now()

  /**
   * Der Zustand, den JEDER Link dieser Seite mitschleppen muss — Chips wie Sortier-Überschriften.
   * Standardwerte bleiben `undefined` und damit aus der Adresse heraus: sonst trüge jede URL den
   * vollständigen Zustand mit sich herum.
   */
  const activeQuery = {
    state: filters.state === DEFAULT_EXPERIENCE_FILTERS.state ? undefined : filters.state,
    sort: filters.sort === DEFAULT_EXPERIENCE_FILTERS.sort ? undefined : filters.sort,
    dir: filters.dir === EXPERIENCE_FIRST_DIR[filters.sort] ? undefined : filters.dir,
  }

  // Nur was vom Standard ABWEICHT wird zum Chip; „Nur aktive" ist hier der Standard und damit
  // kein Filter, sondern die Grundeinstellung.
  //
  // `sort`/`dir` reisen in der Adresse mit, bekommen aber KEINEN Chip: ihren Zustand zeigt die
  // Kopfzeile der Tabelle selbst (Pfeil + Akzentfarbe). Ein Chip daneben wäre dieselbe Aussage
  // zweimal — und ein zweiter Ausschalter für etwas, das man nicht abschalten kann (irgendeine
  // Ordnung hat die Liste immer).
  const chips = buildFilterChips(
    '/dashboard/experiences',
    activeQuery,
    Object.fromEntries(STATE_OPTIONS.map((o) => [`state:${o.value}`, o.label])),
    ['sort', 'dir'],
  )

  /** Gemeinsame Argumente der Spaltenüberschriften — dreimal dasselbe wäre dreimal Drift. */
  const sortProps = {
    basePath: '/dashboard/experiences',
    query: activeQuery,
    activeSort: filters.sort,
    activeDir: filters.dir,
  }

  return (
    <div className="gs-page">
      <div className="gs-page-head gs-rise" data-i="0">
        <div>
          <div className="gs-kicker">{labels.experiences}</div>
          <h1>{labels.experiences}</h1>
          <div className="gs-page-lead">
            {activeCount} von {planConfig.maxActiveEvents} aktiven{' '}
            {labels.experiences.toLowerCase()} im Tarif {planConfig.label}.
          </div>
        </div>

        <Link className="btn btn-primary" href="/dashboard/events/new">
          <span className="gs-icn" style={{ width: 14, height: 14 }}>
            <svg viewBox="0 0 24 24">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
          </span>
          {labels.experience} erstellen
        </Link>
      </div>

      {/* Sichtbar ist nur, was gesetzt IST — je ein Chip mit eigenem Ausschalter. Das Formular
          liegt dahinter im <details>. */}
      <div className="gs-filterbar gs-rise" data-i="1">
        <details>
          <summary>
            <span className="gs-icn" aria-hidden="true">
              {ICON_FILTER}
            </span>
            Filter
            {chips.length > 0 && ` · ${chips.length}`}
          </summary>

          <form method="GET" className="gs-panel gs-filters">
            <Field label="Status" name="state" value={filters.state} options={STATE_OPTIONS} />

            {/* Die Sortierung hat hier kein Auswahlfeld mehr — sie sitzt in der Kopfzeile der
                Tabelle. Sie muss aber MITREISEN: ein GET-Formular schickt nur seine eigenen
                Felder, und ohne diese beiden Zeilen würfe jedes „Anwenden" die Ordnung ab. */}
            <input type="hidden" name="sort" value={filters.sort} />
            <input type="hidden" name="dir" value={filters.dir} />

            <button className="btn btn-primary" type="submit">
              Anwenden
            </button>

            {hasActiveExperienceFilters(filters) && (
              <Link className="btn btn-secondary" href="/dashboard/experiences">
                Zurücksetzen
              </Link>
            )}
          </form>
        </details>

        {chips.map((chip) => (
          <Link key={chip.key} className="gs-filter-chip" href={chip.href}>
            {chip.label}
            <span className="x" aria-hidden="true">
              ×
            </span>
            <span className="sr-only">entfernen</span>
          </Link>
        ))}
      </div>

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
            {visible.length === 1 ? labels.experience : labels.experiences}
          </h3>
          {visible.length !== rows.length && (
            <span style={{ fontSize: 12, color: MUTED }}>
              gefiltert aus {formatNumber(rows.length)}
            </span>
          )}
        </div>

        {rows.length === 0 ? (
          <div
            style={{
              border: '1px dashed var(--color-divider)',
              padding: '40px 20px',
              textAlign: 'center',
            }}
          >
            <p style={{ color: MUTED, marginBottom: 16 }}>
              Noch keine {labels.experiences.toLowerCase()}. Erstelle die erste!
            </p>
            <Link className="btn btn-primary" href="/dashboard/events/new">
              {labels.experience} erstellen
            </Link>
          </div>
        ) : visible.length === 0 ? (
          <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>
            Keine {labels.experiences.toLowerCase()} passen zu diesen Filtern.
          </p>
        ) : (
          <div>
            {/* Die Kopfzeile trägt die Sortierung: klickbar ist, was eine Ordnung hergibt.
                `Typ` und `Status` bleiben absichtlich stumm — der Kampagnentyp ist bei einem
                Tenant immer derselbe (seine business_type erlaubt genau einen), und nach dem
                Status ordnet bereits der Status-FILTER. Beides wäre ein Bedienelement, das
                nichts bewegt.
                Auf dem Telefon stapeln die Zeilen und die Beschriftungen wandern an die Zellen
                (`[data-label]`); von dieser Leiste bleiben dort nur die Sortier-Chips stehen. */}
            <div className="gs-row-head" style={rowCols(GRID, GRID_NARROW)}>
              <SortHeader
                label="Name"
                column="name"
                firstDir={EXPERIENCE_FIRST_DIR.name}
                {...sortProps}
              />
              <SortHeader
                label="Datum"
                column="date"
                firstDir={EXPERIENCE_FIRST_DIR.date}
                {...sortProps}
              />
              <div>Typ</div>
              <div>Status</div>
              <SortHeader
                label="Auslastung"
                column="responses"
                firstDir={EXPERIENCE_FIRST_DIR.responses}
                {...sortProps}
              />
              <div />
            </div>

            {visible.map((row) => {
              const pct = quotaPercent(row.responses, planConfig.maxUploadsPerEvent)

              return (
                <div key={row.id} className="gs-row" style={rowCols(GRID, GRID_NARROW)}>
                  <div style={{ minWidth: 0 }}>
                    <div className="name">{row.name}</div>
                    <div className="kind">
                      {row.responses} {row.responses === 1 ? 'Antwort' : 'Antworten'}
                      {row.lastResponse
                        ? ` · zuletzt ${formatRelative(row.lastResponse, now)}`
                        : ''}
                    </div>
                  </div>

                  {/* data-label: auf dem Telefon stapeln die Zellen und die Kopfzeile trägt dort
                      nur noch die Sortier-Chips — dann trägt jede Zelle ihre Beschriftung selbst
                      (siehe globals.css). */}
                  <div
                    style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}
                    data-label="Datum"
                  >
                    {new Date(row.date).toLocaleDateString('de-DE')}
                  </div>

                  <div style={{ fontSize: 13 }} data-label="Typ">
                    {row.typeLabel}
                  </div>

                  <div data-label="Status">
                    <span className={`tag ${row.archived ? 'tag-neutral' : 'tag-accent'}`}>
                      {row.archived ? 'Archiviert' : 'Aktiv'}
                    </span>
                  </div>

                  {/* Der Wrapper trägt die Beschriftung, nicht die Flex-Zeile darin: ein inline
                      gesetztes `display` schlägt jede Regel aus globals.css, das Etikett-Raster
                      käme also gar nicht zum Zug. */}
                  <div data-label="Auslastung">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="gs-bar" style={{ flex: 1 }}>
                        <i style={{ width: `${pct}%` }} />
                      </div>
                      <div
                        style={{
                          font: '600 12px/1 var(--font-body)',
                          minWidth: 30,
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {Math.round(pct)}%
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      justifyContent: 'flex-end',
                    }}
                  >
                    <form
                      action={async () => {
                        'use server'
                        await setEventArchivedAction(row.id, !row.archived)
                      }}
                    >
                      <button
                        type="submit"
                        style={{
                          background: 'none',
                          border: 0,
                          padding: 0,
                          fontSize: 12,
                          color: MUTED,
                          cursor: 'pointer',
                        }}
                      >
                        {row.archived ? 'Aktivieren' : 'Archivieren'}
                      </button>
                    </form>

                    <Link
                      href={`/dashboard/events/${row.id}`}
                      aria-label={`${row.name} ansehen`}
                      style={{ display: 'inline-flex', color: 'var(--color-accent)' }}
                    >
                      <span className="gs-icn" style={{ width: 16, height: 16 }}>
                        <svg viewBox="0 0 24 24">
                          <path d="M5 12h14" />
                          <path d="M13 5l7 7-7 7" />
                        </svg>
                      </span>
                    </Link>
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
