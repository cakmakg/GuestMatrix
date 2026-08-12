// Reiner CSV-Serializer + Feedback-Export-Builder für das Tenant-Dashboard.
//
// Bewusst OHNE Framework-/Supabase-Importe: die Funktionen sind rein und ohne Mocks testbar.
// Der RLS-aktive Datenzugriff und die signierten Storage-URLs liegen im Route-Handler
// (app/api/events/[eventId]/export/route.ts); hier wird nur formatiert.

/** UTF-8 BOM — sorgt dafür, dass Excel die Datei als UTF-8 öffnet (Umlaute korrekt). */
const BOM = '﻿'

export type ExportSubmissionRow = {
  id: string
  media_url: string | null
  file_type: 'image' | 'video' | null
  uploaded_at: string | null
  deleted_at: string | null
  moderation_flag: boolean
  rating: number | null
  comment: string | null
  feedback_answers: Record<string, number> | null
}

/** Nur die für die CSV-Kopfzeile benötigte Teilmenge von FeedbackQuestion. */
export type CsvFeedbackQuestion = { id: string; prompt: string }

/** Escapt eine einzelne CSV-Zelle nach RFC 4180 (Quote bei , " CR LF; " → ""). */
function csvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/** Serialisiert Zeilen zu CSV (CRLF-getrennt). Fügt KEIN BOM hinzu — das macht der Builder. */
export function toCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((cells) => cells.map(csvCell).join(',')).join('\r\n')
}

/** ISO-Zeitstempel → `YYYY-MM-DD HH:mm` (deterministisch, UTC). Leerer String bei null/ungültig. */
function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 16).replace('T', ' ')
}

function mediaTypeLabel(fileType: 'image' | 'video' | null): string {
  if (fileType === 'image') return 'Foto'
  if (fileType === 'video') return 'Video'
  return ''
}

/**
 * Baut die Feedback-Export-CSV eines Events.
 *
 * Spalten: submission_id, datum, bewertung, <je Frage eine Dimensions-Spalte>, kommentar,
 * gesperrt (Moderations-Status, ja/nein — die eigene Zeile des Tenants bleibt sichtbar),
 * medien_typ, medien_url (kurzlebige signierte URL, siehe signedUrlByPath).
 *
 * DSGVO / Defense-in-Depth: gelöschte (`deleted_at` gesetzt) oder unbestätigte
 * (`uploaded_at` null) Zeilen werden hier NOCH EINMAL herausgefiltert — die Route filtert
 * bereits per Query, aber dieser reine Filter ist die zweite, unit-testbare Verteidigungslinie,
 * damit gelöschte Inhalte niemals in den Export gelangen.
 */
export function buildEventFeedbackCsv(
  submissions: readonly ExportSubmissionRow[],
  questions: readonly CsvFeedbackQuestion[],
  signedUrlByPath: ReadonlyMap<string, string>,
): string {
  const rows = submissions.filter((s) => s.deleted_at === null && s.uploaded_at !== null)

  const header: string[] = [
    'submission_id',
    'datum',
    'bewertung',
    ...questions.map((q) => q.prompt),
    'kommentar',
    'gesperrt',
    'medien_typ',
    'medien_url',
  ]

  const body: string[][] = rows.map((s) => [
    s.id,
    formatDate(s.uploaded_at),
    s.rating !== null ? String(s.rating) : '',
    ...questions.map((q) => {
      const value = s.feedback_answers?.[q.id]
      return typeof value === 'number' ? String(value) : ''
    }),
    s.comment ?? '',
    s.moderation_flag ? 'ja' : 'nein',
    mediaTypeLabel(s.file_type),
    s.media_url ? (signedUrlByPath.get(s.media_url) ?? '') : '',
  ])

  return BOM + toCsv([header, ...body])
}

/** Eine Export-Zeile des Berichts — dieselbe Form wie oben, plus Kampagnenzugehörigkeit. */
export type TenantExportRow = ExportSubmissionRow & {
  event_id: string
  /** Service Recovery (Migration 0020) — leer heißt offen. */
  resolved_at: string | null
}

/**
 * Baut die kampagnenÜBERGREIFENDE Bericht-CSV eines Tenants.
 *
 * Unterschied zu buildEventFeedbackCsv:
 *   * führende Spalte `kampagne` — ohne sie wären die Zeilen mehrerer Kampagnen nicht trennbar
 *   * KEINE `medien_url`: eine signierte URL je Zeile zu erzeugen ist über den gesamten Bestand
 *     teuer und kurzlebig; dieser Export ist zum Auswerten gedacht, nicht zum Verteilen von
 *     Medien. Wer Dateien braucht, exportiert die einzelne Kampagne (mit signierten URLs) oder
 *     lädt sie in der Medien-Bibliothek herunter.
 *
 * Der DSGVO-Filter (gelöscht / unbestätigt) gilt hier genauso — zweite, unit-testbare
 * Verteidigungslinie hinter der Query.
 */
export function buildTenantFeedbackCsv(
  submissions: readonly TenantExportRow[],
  questions: readonly CsvFeedbackQuestion[],
  eventNameById: ReadonlyMap<string, string>,
): string {
  const rows = submissions.filter((s) => s.deleted_at === null && s.uploaded_at !== null)

  const header: string[] = [
    'kampagne',
    'submission_id',
    'datum',
    'bewertung',
    ...questions.map((q) => q.prompt),
    'kommentar',
    'gesperrt',
    'erledigt',
    'medien_typ',
  ]

  const body: string[][] = rows.map((s) => [
    eventNameById.get(s.event_id) ?? '',
    s.id,
    formatDate(s.uploaded_at),
    s.rating !== null ? String(s.rating) : '',
    ...questions.map((q) => {
      const value = s.feedback_answers?.[q.id]
      return typeof value === 'number' ? String(value) : ''
    }),
    s.comment ?? '',
    s.moderation_flag ? 'ja' : 'nein',
    s.resolved_at ? formatDate(s.resolved_at) : '',
    mediaTypeLabel(s.file_type),
  ])

  return BOM + toCsv([header, ...body])
}

/** ASCII-sicherer Dateiname: `guestmatrix-<slug>-<datum>.csv`. Akzente/Sonderzeichen entfallen. */
export function buildExportFilename(eventName: string, eventDate: string): string {
  const slug =
    eventName
      .normalize('NFKD')

      .replace(/[^\x00-\x7F]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'export'
  return `guestmatrix-${slug}-${eventDate}.csv`
}
