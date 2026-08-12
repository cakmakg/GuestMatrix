import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { requireTenantAuth } from '@/lib/auth/session'
import { BRAND } from '@/lib/brand'
import {
  applyExperienceFilters,
  hasActiveExperienceFilters,
  parseExperienceFilters,
  sortExperiences,
} from '@/lib/dashboard/experience-filters'
import { formatNumber, formatRelative, quotaPercent } from '@/lib/dashboard/metrics'
import { getPlanConfig, resolvePlan } from '@/lib/plans'
import { getCampaignConfig, isCampaignType, resolveDashboardLabels } from '@/lib/sectors'
import { createSupabaseServerClient } from '@/lib/supabase/server'

import { setEventArchivedAction } from '../actions'

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
const GRID = 'minmax(0, 1fr) 130px 92px 128px 108px'

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

  const visible = sortExperiences(applyExperienceFilters(rows, filters), filters.sort)
  const activeCount = rows.filter((row) => !row.archived).length
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
      <div
        className="gs-rise"
        data-i="0"
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 24,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              letterSpacing: '.12em',
              textTransform: 'uppercase',
              color: 'var(--color-accent)',
              marginBottom: 6,
            }}
          >
            {labels.experiences}
          </div>
          <h1 style={{ fontSize: 40, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            {labels.experiences}
          </h1>
          <div
            style={{
              fontSize: 14,
              color: 'color-mix(in srgb, var(--color-text) 65%, transparent)',
              maxWidth: 640,
            }}
          >
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

      <form
        method="GET"
        className="gs-panel gs-rise"
        data-i="1"
        style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 14 }}
      >
        <Field
          label="Status"
          name="state"
          value={filters.state}
          options={[
            { value: 'active', label: 'Nur aktive' },
            { value: 'archived', label: 'Nur archivierte' },
            { value: 'all', label: 'Alle' },
          ]}
        />
        <Field
          label="Sortierung"
          name="sort"
          value={filters.sort}
          options={[
            { value: 'date', label: 'Datum (neueste zuerst)' },
            { value: 'responses', label: 'Antworten (meiste zuerst)' },
            { value: 'name', label: 'Name (A–Z)' },
          ]}
        />

        <button className="btn btn-primary" type="submit">
          Anwenden
        </button>

        {hasActiveExperienceFilters(filters) && (
          <Link className="btn btn-secondary" href="/dashboard/experiences">
            Zurücksetzen
          </Link>
        )}
      </form>

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
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: GRID,
                gap: 16,
                padding: '0 4px 8px',
                fontSize: 10,
                letterSpacing: '.1em',
                textTransform: 'uppercase',
                color: MUTED,
              }}
            >
              <div>Name</div>
              <div>Typ</div>
              <div>Status</div>
              <div>Auslastung</div>
              <div />
            </div>

            {visible.map((row) => {
              const pct = quotaPercent(row.responses, planConfig.maxUploadsPerEvent)

              return (
                <div key={row.id} className="gs-row" style={{ gridTemplateColumns: GRID }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="name">{row.name}</div>
                    <div className="kind">
                      {new Date(row.date).toLocaleDateString('de-DE')} · {row.responses}{' '}
                      {row.responses === 1 ? 'Antwort' : 'Antworten'}
                      {row.lastResponse
                        ? ` · zuletzt ${formatRelative(row.lastResponse, now)}`
                        : ''}
                    </div>
                  </div>

                  <div style={{ fontSize: 13 }}>{row.typeLabel}</div>

                  <div>
                    <span className={`tag ${row.archived ? 'tag-neutral' : 'tag-accent'}`}>
                      {row.archived ? 'Archiviert' : 'Aktiv'}
                    </span>
                  </div>

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
