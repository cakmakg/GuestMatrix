import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { requireTenantAuth } from '@/lib/auth/session'
import { BRAND } from '@/lib/brand'
import {
  average,
  negativeShare,
  parseAnswers,
  ratingDistribution,
  resolveQuestionCatalog,
  summarizeDimensions,
  weakestDimension,
} from '@/lib/dashboard/feedback-summary'
import type { DimensionSummary } from '@/lib/dashboard/feedback-summary'
import { formatNumber } from '@/lib/dashboard/metrics'
import { getCampaignConfig, isCampaignType } from '@/lib/sectors'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: `Berichte – ${BRAND.name}` }

type TenantRow = { sector: string; business_type: string | null }
type EventRow = { id: string; name: string; campaign_type: string; archived_at: string | null }
type SubmissionRow = {
  event_id: string
  rating: number | null
  feedback_answers: unknown
  media_url: string | null
  moderation_flag: boolean
}

const MUTED = 'color-mix(in srgb, var(--color-text) 55%, transparent)'

/** Balken auf der 1–5-Skala. `null` bleibt sichtbar leer statt als 0 gezeichnet zu werden. */
function DimensionRow({ summary }: { summary: DimensionSummary }): React.ReactElement {
  const pct = summary.average === null ? 0 : (summary.average / 5) * 100

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 1fr 76px',
        alignItems: 'center',
        gap: 16,
        padding: '11px 2px',
        borderTop: '1px solid var(--color-divider)',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ font: '600 14px/1.3 var(--font-body)' }}>{summary.prompt}</div>
        <div style={{ fontSize: 12, color: MUTED }}>
          {summary.responses} {summary.responses === 1 ? 'Antwort' : 'Antworten'}
        </div>
      </div>

      <div className="gs-bar">
        <i style={{ width: `${pct}%` }} />
      </div>

      <div
        style={{
          font: '800 16px/1 var(--font-heading)',
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
          color: summary.average === null ? MUTED : 'var(--color-text)',
        }}
      >
        {summary.average === null ? '—' : formatNumber(summary.average, 1)}
      </div>
    </div>
  )
}

export default async function ReportsPage() {
  let tenantId: string
  try {
    const session = await requireTenantAuth()
    tenantId = session.tenantId
  } catch {
    redirect('/login')
  }

  const supabase = await createSupabaseServerClient()

  const { data: tenant } = await supabase
    .from('tenants')
    .select('sector, business_type')
    .single<TenantRow>()

  const { data: eventsData } = await supabase
    .from('events')
    .select('id, name, campaign_type, archived_at')
    .eq('tenant_id', tenantId)
    .order('date', { ascending: false })

  const { data: subsData } = await supabase
    .from('submissions')
    .select('event_id, rating, feedback_answers, media_url, moderation_flag')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .not('uploaded_at', 'is', null)

  const events = (eventsData as EventRow[]) ?? []
  const subs = (subsData as SubmissionRow[]) ?? []

  // Der Fragenkatalog kommt aus der Registry, abgeleitet aus (sector, business_type) —
  // kein Sonderfall-Code je Geschäftsart. Mehrere erlaubte Kampagnentypen werden vereinigt;
  // gleiche Frage-ID (z. B. `value`) erscheint dabei nur einmal.
  const questions = resolveQuestionCatalog(tenant?.sector, tenant?.business_type)

  const answerSets = subs.map((sub) => parseAnswers(sub.feedback_answers))
  const dimensions = summarizeDimensions(answerSets, questions)
  const weakest = weakestDimension(dimensions)

  const ratings = subs.map((s) => s.rating).filter((r): r is number => r !== null)
  const overall = average(ratings)
  const distribution = ratingDistribution(ratings)
  const critical = negativeShare(ratings)

  const mediaTotal = subs.filter((s) => s.media_url !== null).length
  const blocked = subs.filter((s) => s.moderation_flag).length
  const released = subs.filter((s) => s.media_url !== null && !s.moderation_flag).length

  // Kampagnen-Vergleich: nur Kampagnen mit mindestens einer Bewertung sind vergleichbar.
  const perCampaign = events
    .map((event) => {
      const eventRatings = subs
        .filter((s) => s.event_id === event.id)
        .map((s) => s.rating)
        .filter((r): r is number => r !== null)
      return {
        id: event.id,
        name: event.name,
        label: isCampaignType(event.campaign_type)
          ? (getCampaignConfig(event.campaign_type)?.label ?? event.campaign_type)
          : event.campaign_type,
        archived: event.archived_at !== null,
        responses: eventRatings.length,
        average: average(eventRatings),
      }
    })
    .filter((row) => row.responses > 0)
    .sort((a, b) => (b.average ?? 0) - (a.average ?? 0))

  const hasAnswers = answerSets.some((set) => Object.keys(set).length > 0)

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
          Berichte
        </div>
        <h1 style={{ fontSize: 40, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
          Zufriedenheit im Detail
        </h1>
        <div
          style={{
            fontSize: 14,
            color: 'color-mix(in srgb, var(--color-text) 65%, transparent)',
            maxWidth: 640,
          }}
        >
          Wo die Gesamtnote herkommt — aufgeschlüsselt nach den Bereichen, die deine Gäste einzeln
          bewerten.
        </div>
      </div>

      {/* ═══ Bereichs-Aufschlüsselung ═══ */}
      <section className="gs-panel gs-rise" data-i="1">
        <div>
          <h3 style={{ fontSize: 20, margin: '0 0 4px' }}>Zufriedenheit nach Bereich</h3>
          <div style={{ fontSize: 12, color: MUTED }}>
            Skala 1–5 · {formatNumber(subs.length)} ausgewertete Beiträge
          </div>
        </div>

        {dimensions.length === 0 ? (
          <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>
            Für diese Geschäftsart ist kein Fragenkatalog hinterlegt.
          </p>
        ) : !hasAnswers ? (
          <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>
            Noch keine Detailbewertungen. Sobald Gäste die Einzelfragen beantworten, erscheint hier
            die Aufschlüsselung.
          </p>
        ) : (
          <>
            <div>
              {dimensions.map((summary) => (
                <DimensionRow key={summary.id} summary={summary} />
              ))}
            </div>

            {weakest && weakest.average !== null && (
              <div
                style={{
                  borderLeft: '3px solid var(--color-accent)',
                  background: 'var(--color-accent-100)',
                  color: 'var(--color-accent-800)',
                  padding: '12px 14px',
                  fontSize: 13,
                }}
              >
                Schwächster Bereich: <strong>{weakest.prompt}</strong> mit{' '}
                {formatNumber(weakest.average, 1)} aus {weakest.responses}{' '}
                {weakest.responses === 1 ? 'Antwort' : 'Antworten'}.
              </div>
            )}
          </>
        )}
      </section>

      {/* ═══ Gesamtbewertung + Medien ═══ */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)',
          gap: 20,
          alignItems: 'start',
        }}
      >
        <section className="gs-panel gs-rise" data-i="2">
          <div>
            <h3 style={{ fontSize: 20, margin: '0 0 4px' }}>Gesamtbewertung</h3>
            <div style={{ fontSize: 12, color: MUTED }}>
              {formatNumber(ratings.length)} {ratings.length === 1 ? 'Bewertung' : 'Bewertungen'}
            </div>
          </div>

          {ratings.length === 0 ? (
            <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>Noch keine Bewertungen.</p>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <div style={{ font: '800 38px/1 var(--font-heading)', letterSpacing: '-0.025em' }}>
                  {overall !== null ? formatNumber(overall, 1) : '—'}
                </div>
                <span style={{ fontSize: 14, color: MUTED }}>/ 5,0</span>
                {critical !== null && (
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: MUTED }}>
                    {formatNumber(critical, 1)} % kritisch (≤ 2)
                  </span>
                )}
              </div>

              <div>
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = distribution[star - 1] ?? 0
                  const pct = ratings.length > 0 ? (count / ratings.length) * 100 : 0
                  return (
                    <div
                      key={star}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '34px 1fr 48px',
                        alignItems: 'center',
                        gap: 12,
                        padding: '6px 0',
                      }}
                    >
                      <span style={{ fontSize: 13, color: MUTED }}>{star} ★</span>
                      <div className="gs-bar">
                        <i style={{ width: `${pct}%` }} />
                      </div>
                      <span
                        style={{
                          fontSize: 12,
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {formatNumber(count)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </section>

        <section className="gs-panel gs-rise" data-i="3">
          <div>
            <h3 style={{ fontSize: 20, margin: '0 0 4px' }}>Medien &amp; Freigabe</h3>
            <div style={{ fontSize: 12, color: MUTED }}>Was du im Marketing einsetzen kannst</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[
              { label: 'Medien gesamt', value: mediaTotal },
              { label: 'Freigegeben', value: released },
              { label: 'Gesperrt', value: blocked },
            ].map((row) => (
              <div
                key={row.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: 12,
                  padding: '10px 2px',
                  borderTop: '1px solid var(--color-divider)',
                }}
              >
                <span style={{ fontSize: 13 }}>{row.label}</span>
                <span
                  style={{
                    font: '800 18px/1 var(--font-heading)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatNumber(row.value)}
                </span>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>
            Jeder Beitrag trägt eine dokumentierte Einwilligung — sie ist Voraussetzung für das
            Speichern und wird mit Zeitstempel festgehalten.
          </p>
        </section>
      </div>

      {/* ═══ Kampagnen-Vergleich ═══ */}
      <section className="gs-panel gs-rise" data-i="4">
        <div>
          <h3 style={{ fontSize: 20, margin: '0 0 4px' }}>Kampagnen im Vergleich</h3>
          <div style={{ fontSize: 12, color: MUTED }}>
            Nur Kampagnen mit mindestens einer Bewertung
          </div>
        </div>

        {perCampaign.length === 0 ? (
          <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>Noch keine bewertete Kampagne.</p>
        ) : (
          <div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) 130px 92px 1fr 60px',
                gap: 16,
                padding: '0 2px 8px',
                fontSize: 10,
                letterSpacing: '.1em',
                textTransform: 'uppercase',
                color: MUTED,
              }}
            >
              <div>Kampagne</div>
              <div>Typ</div>
              <div>Antworten</div>
              <div>Bewertung</div>
              <div style={{ textAlign: 'right' }}>Ø</div>
            </div>

            {perCampaign.map((row) => (
              <div
                key={row.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) 130px 92px 1fr 60px',
                  alignItems: 'center',
                  gap: 16,
                  padding: '11px 2px',
                  borderTop: '1px solid var(--color-divider)',
                }}
              >
                <div style={{ minWidth: 0, font: '600 14px/1.3 var(--font-body)' }}>
                  {row.name}
                  {row.archived && (
                    <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, color: MUTED }}>
                      archiviert
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13 }}>{row.label}</div>
                <div style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                  {formatNumber(row.responses)}
                </div>
                <div className="gs-bar">
                  <i style={{ width: `${((row.average ?? 0) / 5) * 100}%` }} />
                </div>
                <div
                  style={{
                    font: '800 16px/1 var(--font-heading)',
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {row.average !== null ? formatNumber(row.average, 1) : '—'}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
