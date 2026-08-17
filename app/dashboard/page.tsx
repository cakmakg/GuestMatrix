import Link from 'next/link'
import { redirect } from 'next/navigation'
import QRCode from 'qrcode'

import { requireTenantAuth } from '@/lib/auth/session'
import { needsAttention } from '@/lib/dashboard/feedback-filters'
import {
  bucketCounts,
  deltaTone,
  formatNumber,
  formatPercentDelta,
  formatRelative,
  isImprovement,
  percentDelta,
  sparklinePath,
} from '@/lib/dashboard/metrics'
import { mediaKind } from '@/lib/dashboard/media-filters'
import type { HeroStat, HeroStatId } from '@/lib/dashboard/overview'
import { countdownKicker, heroStats, isToday } from '@/lib/dashboard/overview'
import { getPlanConfig, resolvePlan } from '@/lib/plans'
import {
  getCampaignConfig,
  isCampaignType,
  isSector,
  resolveDashboardCapabilities,
  resolveDashboardLabels,
} from '@/lib/sectors'
import { createSupabaseServerClient } from '@/lib/supabase/server'

import { CopyLinkChip } from './CopyLinkChip'
import { EventForm } from './events/new/EventForm'
import { rowCols } from './row-cols'

type EventRow = {
  id: string
  name: string
  date: string
  venue: string | null
  campaign_type: string
  flow_mode: string
  archived_at: string | null
  created_at: string
}

type SubmissionRow = {
  event_id: string
  rating: number | null
  guest_user_id: string
  guest_name: string | null
  comment: string | null
  media_url: string | null
  file_type: string | null
  moderation_flag: boolean
  uploaded_at: string | null
  resolved_at: string | null
}

type TenantRow = { plan: string; sector: string; business_type: string | null }

const MUTED = 'color-mix(in srgb, var(--color-text) 55%, transparent)'
const DAY_MS = 86_400_000
const WEEK_MS = 7 * DAY_MS
const SPARK_BUCKETS = 8

const DAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']
const MONTHS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]

function formatToday(d: Date): string {
  return `${DAYS[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}`
}

function initialsOf(name: string): string {
  const [first, second] = name.trim().split(/\s+/).filter(Boolean)
  if (!first) return 'G'
  if (!second) return first.slice(0, 2).toUpperCase()
  return `${first.charAt(0)}${second.charAt(0)}`.toUpperCase()
}

/** Laufende Summe — für Kennzahlen, die kumulativ wachsen (Gesamtzahlen). */
function runningTotal(series: readonly number[], offset: number): number[] {
  let acc = offset
  return series.map((value) => {
    acc += value
    return acc
  })
}

const ARROW_UP = (
  <svg viewBox="0 0 24 24">
    <path d="M7 17L17 7" />
    <path d="M8 7h9v9" />
  </svg>
)
const ARROW_DOWN = (
  <svg viewBox="0 0 24 24">
    <path d="M7 7l10 10" />
    <path d="M17 8v9H8" />
  </svg>
)
const ARROW_FLAT = (
  <svg viewBox="0 0 24 24">
    <path d="M5 12h14" />
  </svg>
)

type Kpi = {
  label: string
  value: string
  unit?: string
  delta: string
  tone: 'up' | 'down' | 'flat' | 'new'
  series: number[]
  /** Zielbildschirm — eine Kennzahl ohne Anschlusshandlung bleibt Dekoration. */
  href?: string
  /**
   * Auf `false` setzen, wenn ein Anstieg eine Verschlechterung ist (offene Punkte).
   * Ohne das läse ein wachsender Stapel kritischer Rückmeldungen wie ein Erfolg.
   */
  higherIsBetter?: boolean
}

function KpiCard({ kpi, index }: { kpi: Kpi; index: number }): React.ReactElement {
  const spark = sparklinePath(kpi.series)
  const icon = kpi.tone === 'up' ? ARROW_UP : kpi.tone === 'down' ? ARROW_DOWN : ARROW_FLAT

  // Modernist kennt nur einen Akzent: Betonung heißt „gut", gedämpft heißt „nicht gut".
  // Die Pfeilrichtung bleibt sachlich (sie zeigt die Richtung, nicht die Bewertung).
  const improved = isImprovement(kpi.tone, kpi.higherIsBetter)
  const toneColor = improved ? 'var(--color-accent-700)' : 'var(--color-neutral-700)'

  const label = (
    <div
      style={{
        fontSize: 10,
        letterSpacing: '.12em',
        textTransform: 'uppercase',
        color: 'color-mix(in srgb, var(--color-text) 60%, transparent)',
      }}
    >
      {kpi.label}
    </div>
  )

  return (
    <div className="gs-kpi gs-rise" data-i={index}>
      {kpi.href ? (
        <Link href={kpi.href} style={{ color: 'inherit', textDecoration: 'none' }}>
          {label}
        </Link>
      ) : (
        label
      )}

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
        <div
          style={{
            font: 'var(--font-heading-weight) 38px/1 var(--font-heading)',
            letterSpacing: '-0.025em',
          }}
        >
          {kpi.value}
        </div>
        {kpi.unit && <span style={{ fontSize: 14, color: MUTED }}>{kpi.unit}</span>}
      </div>

      <div
        className="gs-kpi-delta"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginTop: 2,
          fontSize: 12,
          color: toneColor,
        }}
      >
        <span className="gs-icn" style={{ width: 12, height: 12 }}>
          {icon}
        </span>
        <span>{kpi.delta}</span>
        <span style={{ color: 'color-mix(in srgb, var(--color-text) 50%, transparent)' }}>
          vs. Vormonat
        </span>
      </div>

      {spark.line && (
        <svg
          className="gs-spark"
          viewBox="0 0 100 32"
          preserveAspectRatio="none"
          aria-hidden="true"
          style={{
            width: '100%',
            height: 34,
            marginTop: 12,
            color: 'var(--color-accent)',
            display: 'block',
          }}
        >
          <path className="fill" d={spark.fill} fill="currentColor" opacity="0.12" />
          <path
            className="line"
            d={spark.line}
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  )
}

const ICON_CALENDAR = (
  <svg viewBox="0 0 24 24">
    <rect x="3" y="5" width="18" height="16" />
    <path d="M8 3v4M16 3v4M3 10h18" />
  </svg>
)
const ICON_PIN = (
  <svg viewBox="0 0 24 24">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
)

/**
 * Ein Symbol je Kennzahl, gekeyt auf die stabile `HeroStatId` aus `lib/dashboard/overview.ts`.
 *
 * Über die id und nicht über die Beschriftung: die Beschriftung kommt aus der Registry und heißt
 * je Geschäftsmodell anders („Glückwünsche" vs. „Rückmeldungen"), das Symbol soll aber dasselbe
 * bleiben. Ein vollständiger Record erzwingt außerdem, dass eine neue Kennzahl hier auftaucht —
 * sonst stünde sie ohne Symbol da.
 */
const STAT_ICONS: Record<HeroStatId, React.ReactElement> = {
  responses: (
    <svg viewBox="0 0 24 24">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  rating: (
    <svg viewBox="0 0 24 24">
      <path d="M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9z" />
    </svg>
  ),
  media: (
    <svg viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  ),
  photos: (
    <svg viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  ),
  videos: (
    <svg viewBox="0 0 24 24">
      <rect x="2" y="6" width="14" height="12" rx="2" />
      <path d="M16 10l6-3v10l-6-3z" />
    </svg>
  ),
  guests: (
    <svg viewBox="0 0 24 24">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 5.5a3.2 3.2 0 0 1 0 6M17.5 14.2A6.5 6.5 0 0 1 21.5 20" />
    </svg>
  ),
  open: (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6M12 16.5v.5" />
    </svg>
  ),
}

/**
 * Der Kopf der Ein-Kampagnen-Übersicht: Name groß, darunter Datum und Ort, darunter drei Zahlen.
 *
 * Diese Ansicht ersetzt die Kachelwand, sobald genau EINE Kampagne läuft — im Free-Tarif ist das
 * immer der Fall (`maxActiveEvents: 1`). Der Umweg „Liste → Detail" hat dort nichts zu sortieren
 * und kostet nur einen Fingertipp.
 */
function CampaignHero({
  event,
  kicker,
  stats,
  guestUrl,
  experiencesLabel,
}: {
  event: EventRow
  /** Kampagnentyp — vor der Feier mit Countdown, siehe countdownKicker. */
  kicker: string
  stats: HeroStat[]
  /** Die Adresse hinter dem QR-Code — zum Weitergeben ohne Ausdruck. */
  guestUrl: string
  /** Plural aus der Registry („Feiern", „Aufenthalte") für den Weg zur vollständigen Liste. */
  experiencesLabel: string
}): React.ReactElement {
  const date = new Date(event.date).toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <section
      className="gs-rise"
      data-i="1"
      style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
    >
      <div>
        <div className="gs-kicker">{kicker}</div>
        <h1 className="gs-hero-name">{event.name}</h1>
        <div className="gs-hero-meta">
          <span>
            <span className="gs-icn" style={{ width: 14, height: 14 }}>
              {ICON_CALENDAR}
            </span>
            {date}
          </span>
          {event.venue && event.venue.trim() !== '' && (
            <span>
              <span className="gs-icn" style={{ width: 14, height: 14 }}>
                {ICON_PIN}
              </span>
              {event.venue}
            </span>
          )}
        </div>
      </div>

      {/* Nicht jeder Gast steht vor dem aufgestellten QR-Code — wer später gratuliert, bekommt
          denselben Weg als Link in die Nachricht. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <CopyLinkChip url={guestUrl} label="Gästelink" />
      </div>

      <div className="gs-hero-stats">
        {stats.map((stat) => (
          <Link
            key={stat.id}
            href={stat.href}
            style={{ color: 'inherit', textDecoration: 'none', display: 'block' }}
          >
            <span className="gs-hero-stat-icon" aria-hidden="true">
              {STAT_ICONS[stat.id]}
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span className="gs-hero-stat-value">{stat.value}</span>
              {stat.unit && <span style={{ fontSize: 12, color: MUTED }}>{stat.unit}</span>}
            </div>
            <div className="gs-hero-stat-label">{stat.label}</div>
            {stat.delta && (
              <div style={{ fontSize: 11, color: 'var(--color-accent-700)', marginTop: 4 }}>
                {stat.delta}
              </div>
            )}
          </Link>
        ))}
      </div>

      {/* Der Weg zur vollständigen Liste — und im Sammel-Flow (Gästebuch) auf dem Telefon der
          EINZIGE. Zwei Dinge treffen hier zusammen: bei genau einer laufenden Kampagne entfällt
          die Kurzliste weiter unten (sie wäre eine zweite Schaltfläche für die Überschrift), und
          die untere Leiste des Sammel-Flows trägt die Kampagnenliste nicht — dort steht die
          Galerie, weil sie öfter gebraucht wird. Ohne diese Zeile wäre das Archiv der Feiern auf
          dem Telefon unerreichbar; das Brautpaar sucht es nach der Feier aber genau dort.
          Der Betriebspfad findet die Liste zusätzlich in der Schublade — ein zweiter Weg zum
          selben Ziel ist hier kein Fehler, sondern derselbe Satz in beiden Formen. */}
      <Link
        className="btn btn-ghost"
        href="/dashboard/experiences"
        // 44px: auf dem Telefon ist das ein Ziel für den Daumen, kein Beiwerk am Rand.
        style={{ alignSelf: 'flex-start', minHeight: 44 }}
      >
        Alle {experiencesLabel} (mit Archiv)
        <span className="gs-icn" style={{ width: 12, height: 12 }}>
          <svg viewBox="0 0 24 24">
            <path d="M5 12h14" />
            <path d="M13 5l7 7-7 7" />
          </svg>
        </span>
      </Link>
    </section>
  )
}

export default async function DashboardPage({
  searchParams,
}: {
  // Nur für die Fehlermeldung des Anlegen-Formulars, das im Leerzustand hier steht.
  searchParams: Promise<{ error?: string }>
}) {
  const { error: createError } = await searchParams

  let tenantId: string
  try {
    const session = await requireTenantAuth()
    tenantId = session.tenantId
  } catch {
    redirect('/login')
  }

  const supabase = await createSupabaseServerClient()

  // RLS-aktiver Server-Client: Tenant-Isolierung wird in der DB durchgesetzt. Die
  // .eq('tenant_id')-Filter bleiben als Defense-in-Depth über RLS.
  const { data: eventsData } = await supabase
    .from('events')
    .select('id, name, date, venue, campaign_type, flow_mode, archived_at, created_at')
    .eq('tenant_id', tenantId)
    .order('date', { ascending: false })

  const { data: subsData } = await supabase
    .from('submissions')
    .select(
      'event_id, rating, guest_user_id, guest_name, comment, media_url, file_type, moderation_flag, uploaded_at, resolved_at',
    )
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .not('uploaded_at', 'is', null)
    .order('uploaded_at', { ascending: false })

  const { data: tenant } = await supabase
    .from('tenants')
    .select('plan, sector, business_type')
    .single<TenantRow>()

  const events = (eventsData as EventRow[]) ?? []
  const subs = (subsData as SubmissionRow[]) ?? []

  const now = Date.now()
  const planConfig = getPlanConfig(resolvePlan(tenant?.plan))
  // Benennung aus der Registry — die Seite verzweigt nicht selbst über die Geschaeftsart.
  const labels = resolveDashboardLabels(tenant?.sector, tenant?.business_type)
  // Ebenso die Panels: ein Gästebuch-Tenant (Hochzeit) kann weder bewerten noch eine Galerie
  // veröffentlichen — Kacheln dafür blieben dauerhaft leer und läsen sich wie ein Datenfehler.
  const can = resolveDashboardCapabilities(tenant?.sector, tenant?.business_type)

  const uploadTimes = subs
    .map((s) => (s.uploaded_at ? new Date(s.uploaded_at).getTime() : null))
    .filter((t): t is number => t !== null)

  // ── Kennzahlen ────────────────────────────────────────────────────────────
  const weekly = bucketCounts(uploadTimes, now, SPARK_BUCKETS, WEEK_MS)
  const last30 = uploadTimes.filter((t) => t >= now - 30 * DAY_MS).length
  const prior30 = uploadTimes.filter((t) => t >= now - 60 * DAY_MS && t < now - 30 * DAY_MS).length

  const totalUploads = subs.length
  const olderThanWindow = totalUploads - weekly.reduce((a, b) => a + b, 0)

  const ratings = subs.map((s) => s.rating).filter((r): r is number => r !== null)
  const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null

  const ratedRecent = subs.filter(
    (s) =>
      s.rating !== null && s.uploaded_at && new Date(s.uploaded_at).getTime() >= now - 30 * DAY_MS,
  )
  const ratedPrior = subs.filter((s) => {
    if (s.rating === null || !s.uploaded_at) return false
    const t = new Date(s.uploaded_at).getTime()
    return t >= now - 60 * DAY_MS && t < now - 30 * DAY_MS
  })
  const avgOf = (rows: SubmissionRow[]): number | null =>
    rows.length === 0 ? null : rows.reduce((sum, r) => sum + (r.rating ?? 0), 0) / rows.length
  const avgRecent = avgOf(ratedRecent)
  const avgPrior = avgOf(ratedPrior)
  const ratingDelta = avgRecent !== null && avgPrior !== null ? avgRecent - avgPrior : null

  const activeEvents = events.filter((e) => e.archived_at === null)
  const createdTimes = events.map((e) => new Date(e.created_at).getTime())
  const eventsWeekly = bucketCounts(createdTimes, now, SPARK_BUCKETS, WEEK_MS)
  const newEvents30 = createdTimes.filter((t) => t >= now - 30 * DAY_MS).length

  const uploadDelta = percentDelta(last30, prior30)

  // ── Medien-Freigabe: was tatsächlich im Marketing einsetzbar ist ──────────
  const withMedia = subs.filter((s) => s.media_url !== null)
  const released = withMedia.filter((s) => !s.moderation_flag)
  const releasedWeekly = bucketCounts(
    released
      .map((s) => (s.uploaded_at ? new Date(s.uploaded_at).getTime() : null))
      .filter((t): t is number => t !== null),
    now,
    SPARK_BUCKETS,
    WEEK_MS,
  )
  const released30 = released.filter(
    (s) => s.uploaded_at !== null && new Date(s.uploaded_at).getTime() >= now - 30 * DAY_MS,
  ).length

  // Ohne Galerie zählt nicht die Freigabe, sondern der Bestand — im Gästebuch bleiben alle
  // Medien privat beim Veranstalter, „freigegeben" hätte dort keinen Adressaten.
  const mediaTimes = withMedia
    .map((s) => (s.uploaded_at ? new Date(s.uploaded_at).getTime() : null))
    .filter((t): t is number => t !== null)
  const mediaWeekly = bucketCounts(mediaTimes, now, SPARK_BUCKETS, WEEK_MS)
  const mediaLast30 = mediaTimes.filter((t) => t >= now - 30 * DAY_MS).length

  // ── Offene Punkte: kritisch ODER gesperrt — und noch nicht bearbeitet ──────
  // Die Regel liegt in lib/dashboard/feedback-filters (needsAttention), damit Übersicht und
  // Antwortliste dieselbe Definition benutzen und sie ohne DB testbar bleibt.
  const openItems = subs.filter((s) =>
    needsAttention({ rating: s.rating, blocked: s.moderation_flag, resolvedAt: s.resolved_at }),
  )
  const attentionTimes = openItems
    .map((s) => (s.uploaded_at ? new Date(s.uploaded_at).getTime() : null))
    .filter((t): t is number => t !== null)
  const attention30 = attentionTimes.filter((t) => t >= now - 30 * DAY_MS).length
  const attentionPrior30 = attentionTimes.filter(
    (t) => t >= now - 60 * DAY_MS && t < now - 30 * DAY_MS,
  ).length
  const attentionDelta = percentDelta(attention30, attentionPrior30)

  // Wie viele Gäste überhaupt etwas hinterlassen haben — im Gästebuch eine andere Aussage als die
  // Zahl der Grüße, weil ein Gast mehrfach schreiben darf. Gezählt wird die Gast-Identität
  // (guest_user_id), nicht der Name: zwei „Familie Müller" wären sonst eine Person. Wer die
  // Sitzung wechselt, zählt allerdings erneut — eine Untergrenze, keine exakte Kopfzahl.
  const contributors = new Set(subs.map((s) => s.guest_user_id)).size
  const contributors30 = new Set(
    subs
      .filter(
        (s) => s.uploaded_at !== null && new Date(s.uploaded_at).getTime() >= now - 30 * DAY_MS,
      )
      .map((s) => s.guest_user_id),
  ).size

  const contributorsKpi: Kpi = {
    label: 'Gäste',
    value: formatNumber(contributors),
    delta: contributors30 === 0 ? '±0' : `+${contributors30}`,
    tone: contributors30 > 0 ? 'up' : 'flat',
    series: weekly,
    href: '/dashboard/feedback',
  }

  // Eigene Konstante statt eines Inline-Objekts im Spread: so bleibt `tone` der Literal-Typ aus
  // Kpi und braucht keine Typzusicherung.
  const ratingKpi: Kpi = {
    label: 'Ø Bewertung',
    value: avgRating !== null ? formatNumber(avgRating, 1) : '—',
    unit: avgRating !== null ? '/ 5,0' : undefined,
    delta:
      ratingDelta === null
        ? 'Neu'
        : `${ratingDelta >= 0 ? '+' : '−'}${formatNumber(Math.abs(ratingDelta), 1)}`,
    tone: ratingDelta === null ? 'new' : ratingDelta > 0 ? 'up' : ratingDelta < 0 ? 'down' : 'flat',
    series: weekly.map(() => (avgRating ?? 0) * 20),
    href: '/dashboard/reports',
  }

  const kpis: Kpi[] = [
    {
      label: labels.activeExperiences,
      value: formatNumber(activeEvents.length),
      delta: newEvents30 === 0 ? '±0' : `+${newEvents30}`,
      tone: newEvents30 > 0 ? 'up' : 'flat',
      series: runningTotal(eventsWeekly, events.length - eventsWeekly.reduce((a, b) => a + b, 0)),
      href: '/dashboard/experiences',
    },
    {
      label: labels.responses,
      value: formatNumber(totalUploads),
      delta: formatPercentDelta(uploadDelta),
      tone: deltaTone(uploadDelta),
      series: runningTotal(weekly, olderThanWindow),
      href: '/dashboard/feedback',
    },
    // Ohne Bewertungen (Gästebuch) gäbe es hier dauerhaft „—" — die Kachel entfällt ganz.
    // An ihrer Stelle steht dort, wo Namen erhoben werden, die Zahl der beitragenden Gäste.
    ...(can.ratingEnabled ? [ratingKpi] : can.guestNameEnabled ? [contributorsKpi] : []),
    // Dieselben Medien, andere Bedeutung: mit Galerie zählt, was VERÖFFENTLICHT werden darf;
    // im geschlossenen Gästebuch gibt es nichts zu veröffentlichen — dort zählt der Bestand.
    can.galleryEnabled
      ? {
          label: 'UGC freigegeben',
          value: formatNumber(released.length),
          delta: released30 === 0 ? '±0' : `+${released30}`,
          tone: released30 > 0 ? 'up' : 'flat',
          series: runningTotal(
            releasedWeekly,
            released.length - releasedWeekly.reduce((a, b) => a + b, 0),
          ),
          href: '/dashboard/media?state=released',
        }
      : {
          label: labels.media,
          value: formatNumber(withMedia.length),
          delta: mediaLast30 === 0 ? '±0' : `+${mediaLast30}`,
          tone: mediaLast30 > 0 ? 'up' : 'flat',
          series: runningTotal(
            mediaWeekly,
            withMedia.length - mediaWeekly.reduce((a, b) => a + b, 0),
          ),
          href: '/dashboard/media',
        },
    {
      label: 'Braucht Aufmerksamkeit',
      value: formatNumber(openItems.length),
      delta: formatPercentDelta(attentionDelta),
      tone: deltaTone(attentionDelta),
      series: bucketCounts(attentionTimes, now, SPARK_BUCKETS, WEEK_MS),
      // Ohne Bewertungen bleiben nur gesperrte Beiträge offen — der Kritisch-Filter träfe nie zu
      // und der Link öffnete garantiert eine leere Liste.
      href: can.ratingEnabled
        ? '/dashboard/feedback?rating=critical'
        : '/dashboard/feedback?state=open',
      // Mehr offene Punkte ist keine Verbesserung.
      higherIsBetter: false,
    },
  ]

  // ── Kurzliste (die vollständige Liste lebt unter /dashboard/experiences) ───
  const uploadsByEvent = new Map<string, number>()
  for (const s of subs) {
    uploadsByEvent.set(s.event_id, (uploadsByEvent.get(s.event_id) ?? 0) + 1)
  }
  const recentEvents = events.slice(0, 5)

  // ── Aktivität ─────────────────────────────────────────────────────────────
  const eventNameById = new Map(events.map((e) => [e.id, e.name]))
  const activities = subs.filter((s) => s.uploaded_at !== null).slice(0, 6)

  const singular = activeEvents.length === 1
  const subtitle =
    activeEvents.length === 0
      ? `Noch keine aktive ${labels.experience}. Erstelle die erste, um Gästebeiträge zu sammeln.`
      : `${activeEvents.length} ${singular ? labels.experience : labels.experiences} ${singular ? 'sammelt' : 'sammeln'} gerade Beiträge deiner Gäste.`

  // ── Ein-Kampagnen-Fall: die Übersicht IST die Kampagne ────────────────────
  // Genau eine laufende Kampagne (im Free-Tarif immer, `maxActiveEvents: 1`) braucht weder eine
  // Liste noch eine Kachelwand — sie braucht ihre eigenen Zahlen. Die Entscheidung hängt an den
  // Daten, nicht am Sektor: ein Hotel mit einem Aufenthalt sieht dasselbe wie ein Brautpaar.
  const soleEvent = activeEvents.length === 1 ? activeEvents[0] : undefined

  const soleSubs = soleEvent ? subs.filter((s) => s.event_id === soleEvent.id) : []
  const solePhotos = soleSubs.filter((s) => mediaKind(s.file_type) === 'photo')
  const soleVideos = soleSubs.filter((s) => mediaKind(s.file_type) === 'video')

  const soleStats = soleEvent
    ? heroStats(
        {
          responses: soleSubs.length,
          media: soleSubs.filter((s) => s.media_url !== null).length,
          photos: solePhotos.length,
          videos: soleVideos.length,
          guests: new Set(soleSubs.map((s) => s.guest_user_id)).size,
          openItems: openItems.filter((s) => s.event_id === soleEvent.id).length,
          averageRating: avgOf(soleSubs.filter((s) => s.rating !== null)),
          today: {
            responses: soleSubs.filter((s) => isToday(s.uploaded_at, now)).length,
            photos: solePhotos.filter((s) => isToday(s.uploaded_at, now)).length,
            videos: soleVideos.filter((s) => isToday(s.uploaded_at, now)).length,
          },
        },
        labels,
        can,
      )
    : []

  const soleTypeLabel =
    soleEvent && isCampaignType(soleEvent.campaign_type)
      ? (getCampaignConfig(soleEvent.campaign_type)?.label ?? labels.experience)
      : labels.experience

  // Vor der Feier zählt der Kicker herunter — das ist die Information, die das Brautpaar in den
  // Tagen davor tatsächlich sucht.
  const soleKicker = soleEvent ? countdownKicker(soleEvent.date, now, soleTypeLabel) : soleTypeLabel

  // Eine Quelle für beide Wege zum Gast: der QR-Code und der Link zum Weitergeben zeigen
  // garantiert auf dieselbe Adresse.
  const soleGuestUrl = soleEvent
    ? `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/e/${soleEvent.id}`
    : ''

  const soleQrDataUrl = soleEvent
    ? await QRCode.toDataURL(soleGuestUrl, { width: 300, margin: 2 })
    : null

  // Noch gar keine Kampagne: die Übersicht IST das Anlegen-Formular.
  //
  // Hier stand vorher eine Beispielansicht mit erfundenen Zahlen. Sie sollte zeigen, wie das
  // Dashboard aussieht, wenn es läuft — beantwortete aber nicht die einzige Frage, die jemand
  // ohne Kampagne hat: wie fange ich an. Wer nichts hat, braucht kein Schaufenster, sondern das
  // Formular; und nach dem Absenden steht an derselben Stelle die echte Kampagne
  // (createEventAction kehrt mit `returnTo` hierher zurück).
  if (events.length === 0) {
    return (
      <div className="gs-page" style={{ maxWidth: 640 }}>
        <div className="gs-page-head gs-rise" data-i="0">
          <div>
            <div className="gs-kicker">{labels.experiences}</div>
            <h1>Erste {labels.experience} anlegen</h1>
            <div className="gs-page-lead">
              Danach bekommst du den QR-Code, den deine Gäste scannen.
            </div>
          </div>
        </div>

        {createError && (
          <div
            className="gs-panel gs-rise"
            data-i="1"
            style={{ borderColor: 'var(--color-accent)', padding: '14px 16px' }}
          >
            {decodeURIComponent(createError)}
          </div>
        )}

        {/* Ohne zugewiesene Branche kennt die Registry keinen Kampagnentyp — das Formular hätte
            dann kein Feld, das es absenden könnte, und liefe erst beim Absenden auf einen Fehler.
            Die Branche weist der Betreiber zu (kein Self-Service), deshalb der Verweis statt eines
            leeren Formulars. Kommt in der Praxis vor: eine Tenant-Zeile ohne `sector`. */}
        {tenant && isSector(tenant.sector) ? (
          <EventForm
            sector={tenant.sector}
            businessType={tenant.business_type}
            returnTo="/dashboard"
            submitLabel={`${labels.experience} erstellen`}
          />
        ) : (
          <div className="gs-panel gs-rise" data-i="2">
            <p style={{ margin: 0, fontSize: 14 }}>
              Deinem Konto ist noch keine Branche zugewiesen — ohne sie steht nicht fest, welche Art
              von {labels.experience} du anlegen kannst.
            </p>
            <Link className="btn btn-secondary" href="/dashboard/settings">
              Zu den Einstellungen
            </Link>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="gs-page">
      {soleEvent ? (
        /* ═══ Eine Kampagne: Kopf = Kampagne ═══ */
        <CampaignHero
          event={soleEvent}
          kicker={soleKicker}
          stats={soleStats}
          guestUrl={soleGuestUrl}
          experiencesLabel={labels.experiences}
        />
      ) : (
        <>
          {/* ═══ Seitenkopf ═══ */}
          <div className="gs-page-head gs-rise" data-i="0">
            <div>
              <div className="gs-kicker">Dashboard · {formatToday(new Date())}</div>
              <h1>Übersicht</h1>
              <div className="gs-page-lead">{subtitle}</div>
            </div>

            <Link className="btn btn-primary" href="/dashboard/events/new">
              <span className="gs-icn" style={{ width: 14, height: 14 }}>
                <svg viewBox="0 0 24 24">
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
              </span>
              Neue Kampagne erstellen
            </Link>
          </div>

          {/* ═══ Kennzahlen ═══ */}
          {/* auto-fit statt fester Spaltenzahl: fünf Karten passen nebeneinander, brechen aber
              auf schmalen Fenstern sauber um, statt zu Zahlenbrei zusammenzuschrumpfen. */}
          <div className="gs-kpi-grid">
            {kpis.map((kpi, i) => (
              <KpiCard key={kpi.label} kpi={kpi} index={i} />
            ))}
          </div>
        </>
      )}

      {/* ═══ Kampagnen + Aktivität ═══ */}
      <div className="gs-split">
        {/* Experiences — Kurzfassung; die vollständige Liste lebt unter /dashboard/experiences.
            Bei genau EINER laufenden Kampagne entfällt sie: eine Liste mit einem Eintrag, der
            schon als Überschrift über der Seite steht, ist nur eine zweite Schaltfläche. */}
        {!soleEvent && (
          <section className="gs-panel gs-rise" data-i="4">
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div>
                <h3 style={{ fontSize: 20, margin: '0 0 4px' }}>{labels.experiences}</h3>
                <div style={{ fontSize: 12, color: MUTED }}>
                  {activeEvents.length} laufend · {events.length - activeEvents.length} archiviert
                </div>
              </div>
              <Link
                className="btn btn-ghost"
                href="/dashboard/experiences"
                style={{ padding: '6px 8px' }}
              >
                Alle ansehen
                <span className="gs-icn" style={{ width: 12, height: 12 }}>
                  <svg viewBox="0 0 24 24">
                    <path d="M5 12h14" />
                    <path d="M13 5l7 7-7 7" />
                  </svg>
                </span>
              </Link>
            </div>

            {events.length === 0 ? (
              <div
                style={{
                  border: '1px dashed var(--color-divider)',
                  padding: '40px 20px',
                  textAlign: 'center',
                }}
              >
                <p style={{ color: MUTED, marginBottom: 16 }}>
                  Noch keine {labels.experiences}. Erstelle die erste!
                </p>
                <Link className="btn btn-primary" href="/dashboard/events/new">
                  {labels.experience} erstellen
                </Link>
              </div>
            ) : (
              <div>
                {recentEvents.map((event) => (
                  <div
                    key={event.id}
                    className="gs-row"
                    style={rowCols('minmax(0, 1fr) 92px 72px')}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ font: '600 14px/1.3 var(--font-body)' }}>{event.name}</div>
                      <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                        {uploadsByEvent.get(event.id) ?? 0} Antworten
                      </div>
                    </div>
                    <div>
                      <span
                        className={`tag ${event.archived_at !== null ? 'tag-neutral' : 'tag-accent'}`}
                      >
                        {event.archived_at !== null ? 'Archiviert' : 'Aktiv'}
                      </span>
                    </div>
                    <Link
                      href={`/dashboard/events/${event.id}`}
                      style={{ fontSize: 12, color: 'var(--color-accent)', textAlign: 'right' }}
                    >
                      Detail →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Aktivität */}
        <section className="gs-panel gs-rise" data-i="5">
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div>
              <h3 style={{ fontSize: 20, margin: '0 0 4px' }}>Letzte Aktivität</h3>
              <div style={{ fontSize: 12, color: MUTED }}>Neueste Gästebeiträge</div>
            </div>
            <Link
              className="btn btn-ghost"
              href="/dashboard/feedback"
              style={{ padding: '6px 8px' }}
            >
              Alle ansehen
              <span className="gs-icn" style={{ width: 12, height: 12 }}>
                <svg viewBox="0 0 24 24">
                  <path d="M5 12h14" />
                  <path d="M13 5l7 7-7 7" />
                </svg>
              </span>
            </Link>
          </div>

          {activities.length === 0 ? (
            <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>
              Sobald Gäste Beiträge hinterlassen, erscheinen sie hier.
            </p>
          ) : (
            <div>
              {activities.map((activity, i) => {
                const who = activity.guest_name?.trim() || 'Gast'
                const eventName = eventNameById.get(activity.event_id) ?? 'Kampagne'
                const what =
                  activity.rating !== null
                    ? `${activity.rating}★ für „${eventName}" hinterlassen`
                    : `hat einen Beitrag zu „${eventName}" hochgeladen`

                return (
                  <div className="gs-act" key={`${activity.event_id}-${i}`}>
                    <div className="gs-avatar">{initialsOf(who)}</div>
                    <div style={{ minWidth: 0 }}>
                      <div className="msg">
                        <span className="name">{who}</span> <span>{what}</span>
                      </div>
                      <div className="when">
                        {activity.uploaded_at ? formatRelative(activity.uploaded_at, now) : ''}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* QR — nur im Ein-Kampagnen-Fall. Er ist dort die häufigste Handlung überhaupt
            (den Gästen zeigen) und läge sonst zwei Tipps tief in der Detailseite. */}
        {soleEvent && soleQrDataUrl && (
          <section className="gs-panel gs-rise" data-i="6" style={{ alignItems: 'center' }}>
            <h3 style={{ fontSize: 20, margin: 0, alignSelf: 'flex-start' }}>QR-Code</h3>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={soleQrDataUrl}
              alt={`QR-Code für ${soleEvent.name}`}
              style={{ width: '100%', maxWidth: 200, height: 'auto', display: 'block' }}
            />
            <Link
              className="btn btn-secondary"
              href={`/dashboard/events/${soleEvent.id}`}
              style={{ width: '100%', justifyContent: 'center', minHeight: 44 }}
            >
              Teilen &amp; verwalten
            </Link>
          </section>
        )}
      </div>

      {/* ═══ Fußzeile ═══ */}
      <div
        className="gs-rise"
        data-i="6"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
          paddingTop: 6,
          fontSize: 12,
          color: MUTED,
        }}
      >
        <div>QR-basierte Gäste-Feedback- und UGC-Plattform</div>
        <div>Tarif: {planConfig.label}</div>
      </div>
    </div>
  )
}
