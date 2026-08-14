import { describe, expect, it } from 'vitest'

import { bottomNavItems, dashboardNavItems, drawerNavItems } from '@/lib/dashboard/nav'
import { countdownKicker, daysUntil, heroStats } from '@/lib/dashboard/overview'
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
  it('never exceeds four — more than that breaks the labels at 360px', () => {
    for (const { labels, can } of [HOTEL, AGENCY, WEDDING]) {
      const items = bottomNavItems(labels, can)
      expect(items.length).toBeGreaterThanOrEqual(3)
      expect(items.length).toBeLessThanOrEqual(4)
    }
  })

  // Im Sammel-Flow ist der QR die häufigste Handlung (er steht auf den Tischen), und Grüße wie
  // Medien sind dasselbe: was die Gäste dagelassen haben. Deshalb Galerie statt zweier Listen.
  it('gives a guestbook tenant its own set with the QR code', () => {
    const items = bottomNavItems(WEDDING.labels, WEDDING.can)
    expect(items.map((i) => i.id)).toEqual(['overview', 'media', 'qr', 'settings'])
    expect(items.map((i) => i.label)).toEqual(['Übersicht', 'Galerie', 'QR-Code', 'Einstellungen'])
  })

  // Drei statt vier: die tägliche Runde. „Mehr" war selbst ein Ziel und belegte einen der
  // knappen Plätze, um danach nur Links aufzuzählen — das macht jetzt die Schublade.
  it('gives hotel and agency the daily three, in their own words', () => {
    for (const { labels, can } of [HOTEL, AGENCY]) {
      expect(bottomNavItems(labels, can).map((i) => i.id)).toEqual([
        'overview',
        'responses',
        'media',
      ])
    }
    expect(bottomNavItems(HOTEL.labels, HOTEL.can)[2]?.label).toBe('Medien')
  })
})

describe('drawerNavItems (hamburger)', () => {
  it('holds exactly what the bottom bar does not', () => {
    const hotel = drawerNavItems(HOTEL.labels, HOTEL.can).map((i) => i.id)
    expect(hotel).toEqual(['experiences', 'reports', 'settings'])
  })

  // Ohne Auswertung fällt „Berichte" weg — die Schublade erbt das, weil sie aus derselben
  // Zielliste abgeleitet wird und nicht aus einer zweiten Aufzählung.
  it('drops reports where the flow carries no evaluation', () => {
    const wedding = drawerNavItems(WEDDING.labels, WEDDING.can).map((i) => i.id)
    expect(wedding).not.toContain('reports')
  })

  it('never duplicates a bottom-bar destination', () => {
    for (const { labels, can } of [HOTEL, AGENCY, WEDDING]) {
      const bottom = new Set(bottomNavItems(labels, can).map((i) => i.id))
      for (const item of drawerNavItems(labels, can)) {
        expect(bottom.has(item.id)).toBe(false)
      }
    }
  })

  // Zusammen müssen beide Formen jedes Ziel der Seitenleiste abdecken: was in keiner von beiden
  // steht, ist auf dem Telefon unerreichbar — und das fiele erst am Gerät auf.
  it('bottom bar and drawer together cover every sidebar destination', () => {
    for (const { labels, can } of [HOTEL, AGENCY]) {
      const reachable = new Set([
        ...bottomNavItems(labels, can).map((i) => i.id),
        ...drawerNavItems(labels, can).map((i) => i.id),
      ])
      for (const item of dashboardNavItems(labels, can)) {
        expect(reachable.has(item.id), `${item.id} ist auf dem Telefon nicht erreichbar`).toBe(true)
      }
    }
  })
})

describe('countdown kicker', () => {
  // 2026-08-13, 14:30 Ortszeit — bewusst nachmittags, damit auffiele, wenn in
  // 24-Stunden-Blöcken statt in Kalendertagen gerechnet würde.
  const now = new Date(2026, 7, 13, 14, 30).getTime()

  it('counts calendar days, independent of the time of day', () => {
    expect(daysUntil('2026-08-13', now)).toBe(0)
    expect(daysUntil('2026-08-14', now)).toBe(1)
    expect(daysUntil('2026-08-25', now)).toBe(12)
    expect(daysUntil('2026-08-12', now)).toBe(-1)

    // Derselbe Tag, andere Uhrzeit → dieselbe Antwort. Genau das bricht bei ms-Arithmetik.
    const morning = new Date(2026, 7, 13, 6, 0).getTime()
    const night = new Date(2026, 7, 13, 23, 59).getTime()
    expect(daysUntil('2026-08-14', morning)).toBe(1)
    expect(daysUntil('2026-08-14', night)).toBe(1)
  })

  it('counts down before, says today on the day, and steps back afterwards', () => {
    expect(countdownKicker('2026-08-25', now, 'Hochzeit')).toBe('Hochzeit · noch 12 Tage')
    expect(countdownKicker('2026-08-14', now, 'Hochzeit')).toBe('Hochzeit · noch 1 Tag')
    expect(countdownKicker('2026-08-13', now, 'Hochzeit')).toBe('Hochzeit · heute')
    // Nach der Feier kein Negativ-Countdown — dann kommen die Beiträge erst richtig.
    expect(countdownKicker('2026-08-01', now, 'Hochzeit')).toBe('Hochzeit')
  })

  it('falls back to the plain label when the date is unreadable', () => {
    expect(daysUntil('kaputt', now)).toBeNull()
    expect(countdownKicker('kaputt', now, 'Hochzeit')).toBe('Hochzeit')
  })
})

describe('heroStats: three numbers over a single campaign', () => {
  const input = {
    responses: 42,
    media: 17,
    photos: 12,
    videos: 5,
    guests: 9,
    openItems: 3,
    averageRating: 4.25,
  }

  it('hotel and agency get responses, rating and open items', () => {
    for (const { labels, can } of [HOTEL, AGENCY]) {
      expect(heroStats(input, labels, can).map((s) => s.id)).toEqual([
        'responses',
        'rating',
        'open',
      ])
    }
  })

  // Im Sammel-Flow zählt, was zusammengekommen ist — und Fotos/Videos getrennt, weil ein
  // Brautpaar sie unterschiedlich verwendet.
  it('a wedding gets greetings, photos and videos', () => {
    const stats = heroStats(input, WEDDING.labels, WEDDING.can)
    expect(stats.map((s) => s.id)).toEqual(['responses', 'photos', 'videos'])
    expect(stats[0]?.label).toBe('Glückwünsche')
    expect(stats[1]?.value).toBe('12')
    expect(stats[2]?.value).toBe('5')
  })

  it('shows a growth line only where something actually grew today', () => {
    const stats = heroStats(
      { ...input, today: { responses: 3, photos: 8, videos: 0 } },
      WEDDING.labels,
      WEDDING.can,
    )
    expect(stats.find((s) => s.id === 'responses')?.delta).toBe('+3 heute')
    expect(stats.find((s) => s.id === 'photos')?.delta).toBe('+8 heute')
    // Kein Zuwachs → keine Zeile. Ein „±0" wäre nur Rauschen.
    expect(stats.find((s) => s.id === 'videos')?.delta).toBeUndefined()
  })

  it('omits the growth line entirely when no today-counts are supplied', () => {
    for (const stat of heroStats(input, WEDDING.labels, WEDDING.can)) {
      expect(stat.delta).toBeUndefined()
    }
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
