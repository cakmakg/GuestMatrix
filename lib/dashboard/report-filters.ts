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

/** Formular- und URL-Format: `YYYY-MM-DD` (entspricht <input type="date">). */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export const reportFilterSchema = z.object({
  from: z.string().regex(ISO_DATE).optional().catch(undefined),
  to: z.string().regex(ISO_DATE).optional().catch(undefined),
})

export type ReportFilters = z.infer<typeof reportFilterSchema>

export const DEFAULT_REPORT_FILTERS: ReportFilters = { from: undefined, to: undefined }

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

/** Hängt den Zeitraum an einen Pfad, damit der CSV-Link denselben Ausschnitt exportiert. */
export function rangeQuery(filters: ReportFilters): string {
  const params = new URLSearchParams()
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  const query = params.toString()
  return query === '' ? '' : `?${query}`
}
