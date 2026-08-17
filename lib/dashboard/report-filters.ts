/**
 * Zeitraum-Filter der Berichte.
 *
 * Wie die Listenfilter (feedback-filters.ts) reist der Zeitraum als `searchParams` durch ein
 * GET-Formular und fällt per `.catch()` auf „kein Filter" zurück statt zu werfen — eine von
 * Hand editierte URL zeigt den Gesamtzeitraum, keine Fehlerseite.
 *
 * Rein (keine DB): die Seite lädt die Zeilen, diese Funktionen grenzen sie ein. Dieselben
 * Funktionen benutzt der CSV-Export (app/api/reports/export/route.ts), damit Bildschirm und
 * Datei denselben Ausschnitt zeigen.
 */

import { z } from 'zod'

import { SORT_DIR_TUPLE, type SortDir, withDir } from './sort'

/** Formular- und URL-Format: `YYYY-MM-DD` (entspricht <input type="date">). */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Sortierung des Kampagnen-Vergleichs. Sie gehört zu den Filtern, weil sie denselben Weg nimmt
 * (searchParams) — sie beschneidet aber nichts und wandert deshalb NICHT in den CSV-Export
 * (`rangeQuery` schickt weiterhin nur den Zeitraum: eine Datei hat keine Spaltenüberschrift, auf
 * die man klickt, und die Tabellenordnung des Bildschirms sagt über den Inhalt nichts aus).
 */
export const REPORT_SORT_TUPLE = ['average', 'responses', 'name'] as const

export type ReportSort = (typeof REPORT_SORT_TUPLE)[number]

/** Richtung beim ersten Klick — und Rückfall für eine Adresse ohne `dir` (wie bei Experiences). */
export const REPORT_FIRST_DIR: Record<ReportSort, SortDir> = {
  average: 'desc',
  responses: 'desc',
  name: 'asc',
}

export const reportFilterSchema = z
  .object({
    from: z.string().regex(ISO_DATE).optional().catch(undefined),
    to: z.string().regex(ISO_DATE).optional().catch(undefined),
    sort: z.enum(REPORT_SORT_TUPLE).catch('average'),
    dir: z.enum(SORT_DIR_TUPLE).optional().catch(undefined),
  })
  .transform(({ from, to, sort, dir }) => ({
    from,
    to,
    sort,
    dir: dir ?? REPORT_FIRST_DIR[sort],
  }))

export type ReportFilters = z.infer<typeof reportFilterSchema>

export const DEFAULT_REPORT_FILTERS: ReportFilters = {
  from: undefined,
  to: undefined,
  sort: 'average',
  dir: REPORT_FIRST_DIR.average,
}

export function parseReportFilters(input: unknown): ReportFilters {
  return reportFilterSchema.parse(input ?? {})
}

export function hasActiveRange(filters: ReportFilters): boolean {
  return filters.from !== undefined || filters.to !== undefined
}

/**
 * Grenzen in Millisekunden. Der Zeitraum ist an BEIDEN Enden inklusiv: `to` meint den ganzen
 * Tag, nicht dessen Mitternacht — sonst fehlte dem Nutzer der zuletzt gewählte Tag.
 *
 * Gerechnet wird in UTC, wie überall sonst im Export (lib/export/csv.ts formatiert ebenfalls
 * in UTC). Ein Datum, das dem Muster entspricht aber nicht existiert (`2026-13-45`), ergibt
 * NaN und wird als „keine Grenze" behandelt — dieselbe Haltung wie beim Zod-`.catch()`.
 */
function boundsOf(filters: ReportFilters): { start: number; end: number } {
  const start = filters.from ? new Date(`${filters.from}T00:00:00.000Z`).getTime() : NaN
  const end = filters.to ? new Date(`${filters.to}T23:59:59.999Z`).getTime() : NaN

  return {
    start: Number.isNaN(start) ? -Infinity : start,
    end: Number.isNaN(end) ? Infinity : end,
  }
}

/** Die Mindestform, auf der der Zeitraum arbeitet. */
export type DatedItemLike = {
  uploadedAt: string | null
}

/**
 * Grenzt auf den gewählten Zeitraum ein (Kopie; die Eingabe bleibt unberührt).
 *
 * Ohne Zeitraum bleibt alles enthalten — auch Zeilen ohne Zeitstempel. Sobald eine Grenze
 * gesetzt ist, fallen Zeilen ohne (oder mit ungültigem) `uploadedAt` heraus: sie lassen sich
 * keinem Zeitraum zuordnen, und sie stillschweigend mitzuzählen würde den Bericht verfälschen.
 *
 * Ein umgekehrter Zeitraum (`from` nach `to`) liefert bewusst eine leere Menge statt die
 * Grenzen zu tauschen — der Bericht zeigt dann ehrlich „keine Daten" für das, was gefragt wurde.
 */
export function applyDateRange<T extends DatedItemLike>(
  items: readonly T[],
  filters: ReportFilters,
): T[] {
  if (!hasActiveRange(filters)) return [...items]

  const { start, end } = boundsOf(filters)

  return items.filter((item) => {
    if (item.uploadedAt === null) return false
    const time = new Date(item.uploadedAt).getTime()
    if (Number.isNaN(time)) return false
    return time >= start && time <= end
  })
}

/** Eine Zeile des Kampagnen-Vergleichs, soweit sortiert wird. */
export type CampaignRowLike = {
  name: string
  responses: number
  /** `null`, solange niemand bewertet hat. */
  average: number | null
}

/**
 * Aufsteigende Komparatoren; die Richtung dreht `withDir` (wie bei den Experiences).
 *
 * `average` behandelt `null` wie 0 — genau das tat die feste Sortierung vorher auch. Die Zeilen
 * des Vergleichs haben ohnehin mindestens eine Bewertung (die Seite filtert `responses > 0`);
 * der Fall bleibt nur, damit der Typ nicht lügt.
 */
const REPORT_COMPARATORS: Record<ReportSort, (a: CampaignRowLike, b: CampaignRowLike) => number> = {
  average: (a, b) => (a.average ?? 0) - (b.average ?? 0),
  responses: (a, b) => a.responses - b.responses,
  name: (a, b) => a.name.localeCompare(b.name, 'de'),
}

/** Sortiert eine Kopie des Kampagnen-Vergleichs; die Eingabe bleibt unberührt. */
export function sortCampaignRows<T extends CampaignRowLike>(
  rows: readonly T[],
  order: ReportSort,
  dir: SortDir = REPORT_FIRST_DIR[order],
): T[] {
  const compare = REPORT_COMPARATORS[order]
  return [...rows].sort((a, b) => withDir(compare(a, b), dir))
}

/** Hängt den Zeitraum an einen Pfad, damit der CSV-Link denselben Ausschnitt exportiert. */
export function rangeQuery(filters: ReportFilters): string {
  const params = new URLSearchParams()
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  const query = params.toString()
  return query === '' ? '' : `?${query}`
}
