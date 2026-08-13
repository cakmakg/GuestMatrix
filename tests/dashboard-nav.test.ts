import { describe, expect, it } from 'vitest'

import { bottomNavItems, dashboardNavItems, moreNavItems } from '@/lib/dashboard/nav'
import { heroStats } from '@/lib/dashboard/overview'
import { resolveDashboardCapabilities, resolveDashboardLabels } from '@/lib/sectors'

// Die drei aktiven Geschäftsmodelle, so wie das Dashboard sie aus der Registry auflöst.
// (sector, business_type) → Beschriftungen + Fähigkeiten. Kein Test verzweigt über den Sektor;
// er prüft, dass die Ableitung das Richtige liefert.
const HOTEL = {
  labels: resolveDashboardLabels('tourism', 'hotel'),
  can: resolveDashboardCapabilities('tourism', 'hotel'),
}
const AGENCY = {
  labels: resolveDashboardLabels('tourism', 'agency'),
  can: resolveDashboardCapabilities('tourism', 'agency'),
}
const WEDDING = {
  labels: resolveDashboardLabels('event', null),
  can: resolveDashboardCapabilities('event', null),
}

describe('dashboard capabilities: operating tools per flow mode', () => {
  it('hotel and agency keep service recovery, reports and export', () => {
    for (const { can } of [HOTEL, AGENCY]) {
      expect(can.serviceRecoveryEnabled).toBe(true)
      expect(can.reportsEnabled).toBe(true)
      expect(can.exportEnabled).toBe(true)
    }
  })

  it('a guestbook tenant has none of them', () => {
    expect(WEDDING.can.serviceRecoveryEnabled).toBe(false)
    expect(WEDDING.can.reportsEnabled).toBe(false)
    expect(WEDDING.can.exportEnabled).toBe(false)
  })

  it('an unknown sector hides nothing (display decision, never a data gate)', () => {
    const can = resolveDashboardCapabilities('nonsense', null)
    expect(can.reportsEnabled).toBe(true)
    expect(can.exportEnabled).toBe(true)
    expect(can.serviceRecoveryEnabled).toBe(true)
  })
})

describe('dashboardNavItems (sidebar)', () => {
  it('drops Berichte exactly when the tenant has no reports', () => {
    const withReports = dashboardNavItems(HOTEL.labels, HOTEL.can).map((i) => i.id)
    const withoutReports = dashboardNavItems(WEDDING.labels, WEDDING.can).map((i) => i.id)

    expect(withReports).toContain('reports')
    expect(withoutReports).not.toContain('reports')
  })

  it('labels come from the registry, not from hardcoded words', () => {
    const hotel = dashboardNavItems(HOTEL.labels, HOTEL.can)
    const wedding = dashboardNavItems(WEDDING.labels, WEDDING.can)

    expect(hotel.find((i) => i.id === 'experiences')?.label).toBe('Aufenthalte')
    expect(wedding.find((i) => i.id === 'experiences')?.label).toBe('Feiern')
    expect(wedding.find((i) => i.id === 'responses')?.label).toBe('Glückwünsche')
  })

  it('every item has a real route and a non-empty label', () => {
    for (const { labels, can } of [HOTEL, AGENCY, WEDDING]) {
      for (const item of dashboardNavItems(labels, can)) {
        expect(item.href.startsWith('/dashboard')).toBe(true)
        expect(item.label.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('bottomNavItems (phone)', () => {
  it('is always exactly four, and the same four for every business model', () => {
    for (const { labels } of [HOTEL, AGENCY, WEDDING]) {
      const ids = bottomNavItems(labels).map((i) => i.id)
      expect(ids).toEqual(['overview', 'responses', 'media', 'more'])
    }
  })

  it('still speaks the tenant language', () => {
    expect(bottomNavItems(WEDDING.labels).map((i) => i.label)).toEqual([
      'Übersicht',
      'Glückwünsche',
      'Fotos & Videos',
      'Mehr',
    ])
  })
})

describe('moreNavItems', () => {
  it('holds exactly what the bottom bar does not', () => {
    const hotel = moreNavItems(HOTEL.labels, HOTEL.can).map((i) => i.id)
    expect(hotel).toEqual(['experiences', 'reports', 'settings'])
  })

  it('thins out on its own for a guestbook tenant', () => {
    const wedding = moreNavItems(WEDDING.labels, WEDDING.can).map((i) => i.id)
    expect(wedding).toEqual(['experiences', 'settings'])
  })

  it('never duplicates a bottom-bar destination', () => {
    for (const { labels, can } of [HOTEL, AGENCY, WEDDING]) {
      const bottom = new Set(bottomNavItems(labels).map((i) => i.id))
      for (const item of moreNavItems(labels, can)) {
        expect(bottom.has(item.id)).toBe(false)
      }
    }
  })
})

describe('heroStats: three numbers over a single campaign', () => {
  const input = { responses: 42, media: 17, guests: 9, openItems: 3, averageRating: 4.25 }

  it('hotel and agency get responses, rating and open items', () => {
    for (const { labels, can } of [HOTEL, AGENCY]) {
      expect(heroStats(input, labels, can).map((s) => s.id)).toEqual([
        'responses',
        'rating',
        'open',
      ])
    }
  })

  it('a wedding gets greetings, media and contributing guests', () => {
    const stats = heroStats(input, WEDDING.labels, WEDDING.can)
    expect(stats.map((s) => s.id)).toEqual(['responses', 'media', 'guests'])
    expect(stats[0]?.label).toBe('Glückwünsche')
    expect(stats[1]?.label).toBe('Fotos & Videos')
  })

  it('always returns three distinct stats for every business model', () => {
    for (const { labels, can } of [HOTEL, AGENCY, WEDDING]) {
      const stats = heroStats(input, labels, can)
      expect(stats).toHaveLength(3)
      expect(new Set(stats.map((s) => s.id)).size).toBe(3)
    }
  })

  it('shows an em dash instead of a zero when nobody has rated yet', () => {
    const stats = heroStats({ ...input, averageRating: null }, HOTEL.labels, HOTEL.can)
    const rating = stats.find((s) => s.id === 'rating')
    expect(rating?.value).toBe('—')
    // Ohne Note gibt es auch keine Skala, an der sie zu lesen wäre.
    expect(rating?.unit).toBeUndefined()
  })

  it('points the open-items stat at the open filter, not at an unfiltered list', () => {
    const open = heroStats(input, HOTEL.labels, HOTEL.can).find((s) => s.id === 'open')
    expect(open?.href).toBe('/dashboard/feedback?state=open')
  })
})
