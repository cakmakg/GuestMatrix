import { describe, expect, it } from 'vitest'

import {
  DEFAULT_REPORT_FILTERS,
  applyDateRange,
  hasActiveRange,
  parseReportFilters,
  rangeQuery,
} from '@/lib/dashboard/report-filters'
import type { DatedItemLike } from '@/lib/dashboard/report-filters'

function item(uploadedAt: string | null): DatedItemLike {
  return { uploadedAt }
}

describe('parseReportFilters', () => {
  it('defaults an empty query to the whole period', () => {
    expect(parseReportFilters({})).toEqual(DEFAULT_REPORT_FILTERS)
    expect(parseReportFilters(undefined)).toEqual(DEFAULT_REPORT_FILTERS)
  })

  it('accepts ISO dates', () => {
    expect(parseReportFilters({ from: '2026-08-01', to: '2026-08-31' })).toEqual({
      from: '2026-08-01',
      to: '2026-08-31',
    })
  })

  // Eine handeditierte URL darf keine Fehlerseite erzeugen.
  it('falls back to no range instead of throwing on garbage', () => {
    expect(parseReportFilters({ from: '01.08.2026', to: 42 })).toEqual(DEFAULT_REPORT_FILTERS)
  })
})

describe('hasActiveRange', () => {
  it('is false without any bound and true with one', () => {
    expect(hasActiveRange(DEFAULT_REPORT_FILTERS)).toBe(false)
    expect(hasActiveRange({ from: '2026-08-01', to: undefined })).toBe(true)
    expect(hasActiveRange({ from: undefined, to: '2026-08-31' })).toBe(true)
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
    const result = applyDateRange(items, { from: '2026-08-01', to: '2026-08-31' })
    expect(result.map((i) => i.uploadedAt)).toEqual([
      '2026-08-01T00:00:00.000Z',
      '2026-08-15T12:00:00.000Z',
      '2026-08-31T23:59:59.000Z',
    ])
  })

  it('applies an open-ended range on either side', () => {
    expect(applyDateRange(items, { from: '2026-08-15', to: undefined })).toHaveLength(3)
    expect(applyDateRange(items, { from: undefined, to: '2026-08-01' })).toHaveLength(2)
  })

  it('yields nothing for a reversed range instead of swapping the bounds', () => {
    expect(applyDateRange(items, { from: '2026-08-31', to: '2026-08-01' })).toHaveLength(0)
  })

  // Regex-gültig, als Datum unmöglich — wird wie „keine Grenze" behandelt.
  it('treats an impossible date as no bound', () => {
    expect(applyDateRange(items, { from: '2026-13-45', to: undefined })).toHaveLength(5)
  })

  it('drops entries without a timestamp once a range is active', () => {
    const withNull = [...items, item(null)]
    expect(applyDateRange(withNull, DEFAULT_REPORT_FILTERS)).toHaveLength(6)
    expect(applyDateRange(withNull, { from: '2026-08-01', to: '2026-08-31' })).toHaveLength(3)
  })

  it('does not mutate the input', () => {
    const original = [...items]
    applyDateRange(items, { from: '2026-08-01', to: '2026-08-31' })
    expect(items).toEqual(original)
  })
})

describe('rangeQuery', () => {
  it('carries the selected period to the export link', () => {
    expect(rangeQuery(DEFAULT_REPORT_FILTERS)).toBe('')
    expect(rangeQuery({ from: '2026-08-01', to: '2026-08-31' })).toBe(
      '?from=2026-08-01&to=2026-08-31',
    )
    expect(rangeQuery({ from: '2026-08-01', to: undefined })).toBe('?from=2026-08-01')
  })
})
