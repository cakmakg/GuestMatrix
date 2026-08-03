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
