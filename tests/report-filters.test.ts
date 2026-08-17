import { describe, expect, it } from 'vitest'

import {
  DEFAULT_REPORT_FILTERS,
  REPORT_FIRST_DIR,
  applyDateRange,
  hasActiveRange,
  parseReportFilters,
  rangeQuery,
  sortCampaignRows,
} from '@/lib/dashboard/report-filters'
import type { CampaignRowLike, DatedItemLike } from '@/lib/dashboard/report-filters'

function item(uploadedAt: string | null): DatedItemLike {
  return { uploadedAt }
}

/** Der Zeitraum-Anteil der Filter; die Sortierung steht auf ihrem Standard. */
function range(from?: string, to?: string) {
  return { ...DEFAULT_REPORT_FILTERS, from, to }
}

describe('parseReportFilters', () => {
  it('defaults an empty query to the whole period', () => {
    expect(parseReportFilters({})).toEqual(DEFAULT_REPORT_FILTERS)
    expect(parseReportFilters(undefined)).toEqual(DEFAULT_REPORT_FILTERS)
  })

  it('accepts ISO dates', () => {
    expect(parseReportFilters(range('2026-08-01', '2026-08-31'))).toEqual(
      range('2026-08-01', '2026-08-31'),
    )
  })

  // Wie bei den Experiences: `?sort=name` von Hand getippt heißt A–Z.
  it('derives the sort direction from the key when the address has none', () => {
    expect(parseReportFilters({ sort: 'name' }).dir).toBe('asc')
    expect(parseReportFilters({ sort: 'responses' }).dir).toBe('desc')
    expect(parseReportFilters({}).sort).toBe('average')
    expect(parseReportFilters({ sort: 'nonsense' })).toEqual(DEFAULT_REPORT_FILTERS)
  })

  // Eine handeditierte URL darf keine Fehlerseite erzeugen.
  it('falls back to no range instead of throwing on garbage', () => {
    expect(parseReportFilters({ from: '01.08.2026', to: 42 })).toEqual(DEFAULT_REPORT_FILTERS)
  })
})

describe('hasActiveRange', () => {
  it('is false without any bound and true with one', () => {
    expect(hasActiveRange(DEFAULT_REPORT_FILTERS)).toBe(false)
    expect(hasActiveRange(range('2026-08-01', undefined))).toBe(true)
    expect(hasActiveRange(range(undefined, '2026-08-31'))).toBe(true)
    // Die Sortierung ist KEIN Zeitraum: sie darf den Zeitraum-Chip nicht erscheinen lassen.
    expect(hasActiveRange({ ...DEFAULT_REPORT_FILTERS, sort: 'name', dir: 'asc' })).toBe(false)
  })
})

describe('applyDateRange', () => {
  const items = [
    item('2026-07-31T23:59:59.000Z'),
    item('2026-08-01T00:00:00.000Z'),
    item('2026-08-15T12:00:00.000Z'),
    item('2026-08-31T23:59:59.000Z'),
    item('2026-09-01T00:00:00.000Z'),
  ]

  it('returns everything when no range is set', () => {
    expect(applyDateRange(items, DEFAULT_REPORT_FILTERS)).toHaveLength(5)
  })

  // Beide Enden inklusiv: der zuletzt gewählte Tag zählt ganz mit, nicht nur seine Mitternacht.
  it('includes both boundary days completely', () => {
    const result = applyDateRange(items, range('2026-08-01', '2026-08-31'))
    expect(result.map((i) => i.uploadedAt)).toEqual([
      '2026-08-01T00:00:00.000Z',
      '2026-08-15T12:00:00.000Z',
      '2026-08-31T23:59:59.000Z',
    ])
  })

  it('applies an open-ended range on either side', () => {
    expect(applyDateRange(items, range('2026-08-15', undefined))).toHaveLength(3)
    expect(applyDateRange(items, range(undefined, '2026-08-01'))).toHaveLength(2)
  })

  it('yields nothing for a reversed range instead of swapping the bounds', () => {
    expect(applyDateRange(items, range('2026-08-31', '2026-08-01'))).toHaveLength(0)
  })

  // Regex-gültig, als Datum unmöglich — wird wie „keine Grenze" behandelt.
  it('treats an impossible date as no bound', () => {
    expect(applyDateRange(items, range('2026-13-45', undefined))).toHaveLength(5)
  })

  it('drops entries without a timestamp once a range is active', () => {
    const withNull = [...items, item(null)]
    expect(applyDateRange(withNull, DEFAULT_REPORT_FILTERS)).toHaveLength(6)
    expect(applyDateRange(withNull, range('2026-08-01', '2026-08-31'))).toHaveLength(3)
  })

  it('does not mutate the input', () => {
    const original = [...items]
    applyDateRange(items, range('2026-08-01', '2026-08-31'))
    expect(items).toEqual(original)
  })
})

describe('rangeQuery', () => {
  it('carries the selected period to the export link', () => {
    expect(rangeQuery(DEFAULT_REPORT_FILTERS)).toBe('')
    expect(rangeQuery(range('2026-08-01', '2026-08-31'))).toBe('?from=2026-08-01&to=2026-08-31')
    expect(rangeQuery(range('2026-08-01', undefined))).toBe('?from=2026-08-01')
  })
})

describe('sortCampaignRows', () => {
  const rows: CampaignRowLike[] = [
    { name: 'Zermatt', responses: 5, average: 4.8 },
    { name: 'Älpli', responses: 50, average: 3.1 },
    { name: 'Meran', responses: 20, average: 4.2 },
  ]

  // Vorher stand dieser Vergleich fest nach Note — das bleibt der Standard.
  it('defaults to the best rating first', () => {
    expect(sortCampaignRows(rows, 'average').map((r) => r.name)).toEqual([
      'Zermatt',
      'Meran',
      'Älpli',
    ])
    expect(REPORT_FIRST_DIR.average).toBe('desc')
  })

  it('can order by response count and by name, in both directions', () => {
    expect(sortCampaignRows(rows, 'responses').map((r) => r.responses)).toEqual([50, 20, 5])
    expect(sortCampaignRows(rows, 'responses', 'asc').map((r) => r.responses)).toEqual([5, 20, 50])
    // Umlaute einreihen statt hinten anhängen (localeCompare('de')).
    expect(sortCampaignRows(rows, 'name').map((r) => r.name)).toEqual(['Älpli', 'Meran', 'Zermatt'])
    expect(sortCampaignRows(rows, 'name', 'desc').map((r) => r.name)).toEqual([
      'Zermatt',
      'Meran',
      'Älpli',
    ])
  })

  it('treats a missing average as the weakest, like the fixed order did', () => {
    const withNull = [...rows, { name: 'Ohne', responses: 1, average: null }]
    expect(
      sortCampaignRows(withNull, 'average')
        .map((r) => r.name)
        .at(-1),
    ).toBe('Ohne')
  })

  it('does not mutate the input array', () => {
    const snapshot = [...rows]
    sortCampaignRows(rows, 'name')
    expect(rows).toEqual(snapshot)
  })
})
