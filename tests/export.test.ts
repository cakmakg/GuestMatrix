import { readFileSync } from 'fs'
import path from 'path'

import { describe, expect, it } from 'vitest'

import {
  buildEventFeedbackCsv,
  buildExportFilename,
  buildTenantFeedbackCsv,
  toCsv,
  type CsvFeedbackQuestion,
  type ExportSubmissionRow,
  type TenantExportRow,
} from '@/lib/export/csv'

// Deckt zwei Ebenen ab:
//  1) das reine CSV-Verhalten (Escaping, Dimensions-Spalten, gesperrt-Spalte, DSGVO-Filter),
//  2) einen Quell-Guard: die Export-Route liest über den RLS-aktiven Server-Client und NICHT
//     über den service_role-Admin-Client (Tenant-Isolierung ist DB-durchgesetzt, Spec C-3).

const STAY_QUESTIONS: CsvFeedbackQuestion[] = [
  { id: 'cleanliness', prompt: 'Sauberkeit' },
  { id: 'service', prompt: 'Service' },
]

function row(overrides: Partial<ExportSubmissionRow> = {}): ExportSubmissionRow {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    media_url: null,
    file_type: null,
    uploaded_at: '2026-07-31T14:03:00.000Z',
    deleted_at: null,
    moderation_flag: false,
    rating: 5,
    comment: 'Alles super',
    feedback_answers: null,
    ...overrides,
  }
}

describe('toCsv — RFC-4180-Escaping', () => {
  it('quotet Zellen mit Komma, Anführungszeichen oder Zeilenumbruch und verdoppelt "', () => {
    const csv = toCsv([
      ['plain', 'a,b', 'sagt "hi"', 'zeile1\nzeile2'],
      ['x', 'y', 'z', 'w'],
    ])
    expect(csv).toBe('plain,"a,b","sagt ""hi""","zeile1\nzeile2"\r\nx,y,z,w')
  })
})

describe('buildEventFeedbackCsv', () => {
  it('schreibt Dimensions-Spalten aus dem Fragenkatalog in die Kopfzeile', () => {
    const csv = buildEventFeedbackCsv([], STAY_QUESTIONS, new Map())
    const header = csv.split('\r\n')[0]
    expect(header).toContain('submission_id,datum,bewertung,Sauberkeit,Service,kommentar,gesperrt')
  })

  it('rendert Bewertung, Dimensionswerte, Kommentar und signierte Medien-URL', () => {
    const sub = row({
      media_url: 'tenant-a/event-a/sub-1/x.jpg',
      file_type: 'image',
      feedback_answers: { cleanliness: 4, service: 5 },
    })
    const signed = new Map([
      ['tenant-a/event-a/sub-1/x.jpg', 'https://signed.example/x.jpg?token=abc'],
    ])
    const csv = buildEventFeedbackCsv([sub], STAY_QUESTIONS, signed)
    const dataLine = csv.split('\r\n')[1]

    expect(dataLine).toContain('2026-07-31 14:03')
    expect(dataLine).toContain(',4,5,') // Dimensionswerte in Katalog-Reihenfolge
    expect(dataLine).toContain('Alles super')
    expect(dataLine).toContain('Foto')
    expect(dataLine).toContain('https://signed.example/x.jpg?token=abc')
  })

  it('behält eine geflaggte Zeile und markiert sie in der gesperrt-Spalte (ja)', () => {
    const flagged = row({ id: 'flagged-id', moderation_flag: true, comment: 'geflaggt' })
    const csv = buildEventFeedbackCsv([flagged], STAY_QUESTIONS, new Map())

    expect(csv).toContain('flagged-id')
    expect(csv).toContain('geflaggt')
    // Die Zeile des geflaggten Beitrags endet mit gesperrt=ja (eigene Daten bleiben sichtbar).
    const dataLine = csv.split('\r\n')[1]
    expect(dataLine).toContain(',ja,')
  })

  it('DSGVO: eine gelöschte Submission (deleted_at gesetzt) erscheint NICHT im Export', () => {
    const kept = row({ id: 'kept-id', comment: 'bleibt' })
    const deleted = row({
      id: 'deleted-id',
      comment: 'darf-nicht-erscheinen',
      deleted_at: '2026-07-31T15:00:00.000Z',
      media_url: 'tenant-a/event-a/sub-del/y.jpg',
    })

    const csv = buildEventFeedbackCsv([kept, deleted], STAY_QUESTIONS, new Map())

    // Genau eine Datenzeile (Kopfzeile + 1), die gelöschte Zeile fehlt vollständig.
    expect(csv.split('\r\n')).toHaveLength(2)
    expect(csv).toContain('kept-id')
    expect(csv).not.toContain('deleted-id')
    expect(csv).not.toContain('darf-nicht-erscheinen')
  })

  it('filtert unbestätigte Zeilen (uploaded_at null) heraus', () => {
    const pending = row({ id: 'pending-id', uploaded_at: null })
    const csv = buildEventFeedbackCsv([pending], STAY_QUESTIONS, new Map())
    expect(csv.split('\r\n')).toHaveLength(1) // nur Kopfzeile
    expect(csv).not.toContain('pending-id')
  })
})

describe('buildTenantFeedbackCsv', () => {
  const EVENT_A = '11111111-1111-4111-8111-111111111111'
  const EVENT_B = '22222222-2222-4222-8222-222222222222'
  const names = new Map([
    [EVENT_A, 'Hotel Ölüdeniz'],
    [EVENT_B, 'Sommertour'],
  ])

  function tenantRow(overrides: Partial<TenantExportRow> = {}): TenantExportRow {
    return { ...row(), event_id: EVENT_A, resolved_at: null, ...overrides }
  }

  it('stellt die Kampagne voran, damit Zeilen mehrerer Kampagnen trennbar bleiben', () => {
    const csv = buildTenantFeedbackCsv(
      [tenantRow(), tenantRow({ id: 'zwei', event_id: EVENT_B })],
      STAY_QUESTIONS,
      names,
    )
    const [header, first, second] = csv.split('\r\n')

    expect(header).toContain('kampagne')
    expect(first).toContain('Hotel Ölüdeniz')
    expect(second).toContain('Sommertour')
  })

  it('führt den Bearbeitungsstand statt einer Medien-URL', () => {
    const csv = buildTenantFeedbackCsv(
      [tenantRow({ resolved_at: '2026-08-05T09:00:00.000Z' })],
      STAY_QUESTIONS,
      names,
    )

    expect(csv).toContain('erledigt')
    expect(csv).toContain('2026-08-05 09:00')
    expect(csv).not.toContain('medien_url')
  })

  it('lässt eine unbekannte Kampagne leer statt die Zeile zu verlieren', () => {
    const csv = buildTenantFeedbackCsv([tenantRow({ event_id: 'weg' })], [], new Map())

    expect(csv.split('\r\n')).toHaveLength(2)
  })

  // Zweite Verteidigungslinie hinter der Query — gelöschte Inhalte dürfen nie exportiert werden.
  it('filtert gelöschte und unbestätigte Zeilen wie der Einzel-Export', () => {
    const csv = buildTenantFeedbackCsv(
      [
        tenantRow({ id: 'geloescht', deleted_at: '2026-08-02T00:00:00.000Z' }),
        tenantRow({ id: 'unbestaetigt', uploaded_at: null }),
        tenantRow({ id: 'sichtbar' }),
      ],
      STAY_QUESTIONS,
      names,
    )

    expect(csv).toContain('sichtbar')
    expect(csv).not.toContain('geloescht')
    expect(csv).not.toContain('unbestaetigt')
  })
})

describe('buildExportFilename', () => {
  it('translitiert Akzente auf Basisbuchstaben und entfernt Sonderzeichen', () => {
    expect(buildExportFilename('Hôtel Ölüdeniz — Sommer!', '2026-07-31')).toBe(
      'guestmatrix-hotel-oludeniz-sommer-2026-07-31.csv',
    )
  })

  it('fällt bei leerem Slug auf "export" zurück', () => {
    expect(buildExportFilename('★★★', '2026-07-31')).toBe('guestmatrix-export-2026-07-31.csv')
  })
})

describe('Export-Route ist RLS-aktiv (kein service_role für Tabellenzugriff)', () => {
  const routeSource = readFileSync(
    path.join(process.cwd(), 'app/api/events/[eventId]/export/route.ts'),
    'utf8',
  )

  it('importiert den RLS-aktiven Server-Client', () => {
    expect(routeSource).toContain('@/lib/supabase/server')
  })

  it('importiert NICHT den service_role-Admin-Client direkt', () => {
    expect(routeSource).not.toContain('@/lib/supabase/admin')
  })
})

describe('Bericht-Export-Route ist RLS-aktiv und Zod-validiert', () => {
  const routeSource = readFileSync(
    path.join(process.cwd(), 'app/api/reports/export/route.ts'),
    'utf8',
  )

  it('importiert den RLS-aktiven Server-Client', () => {
    expect(routeSource).toContain('@/lib/supabase/server')
  })

  it('importiert NICHT den service_role-Admin-Client direkt', () => {
    expect(routeSource).not.toContain('@/lib/supabase/admin')
  })

  // Absolute Projektregel: jede Route validiert ihre Eingabe.
  it('validiert den Zeitraum über das Zod-Schema', () => {
    expect(routeSource).toContain('reportFilterSchema')
    expect(routeSource).toContain('safeParse')
  })
})
