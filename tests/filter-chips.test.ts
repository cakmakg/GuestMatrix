import { describe, expect, it } from 'vitest'

import { buildFilterChips, hrefWithout } from '@/lib/dashboard/filter-chips'

const BASE = '/dashboard/feedback'

describe('hrefWithout', () => {
  it('drops exactly the one filter and keeps the rest', () => {
    expect(hrefWithout(BASE, { rating: 'critical', state: 'open' }, 'rating')).toBe(
      `${BASE}?state=open`,
    )
  })

  it('returns the bare path once nothing is left', () => {
    expect(hrefWithout(BASE, { rating: 'critical' }, 'rating')).toBe(BASE)
  })

  it('ignores unset and empty values instead of writing them into the query', () => {
    // Ein Filter auf seinem Standard gehört nicht in die Adresse — sonst trüge jede URL den
    // vollständigen Zustand mit sich herum.
    expect(hrefWithout(BASE, { rating: undefined, state: '', sort: 'lowest' }, 'nothing')).toBe(
      `${BASE}?sort=lowest`,
    )
  })

  it('escapes values so a campaign name or id cannot break the query', () => {
    const href = hrefWithout(BASE, { campaign: 'a&b=c d' }, 'other')
    expect(href).toContain('campaign=a%26b%3Dc+d')
    expect(new URL(href, 'http://x').searchParams.get('campaign')).toBe('a&b=c d')
  })

  it('leaves the input untouched', () => {
    const active = { rating: 'critical', state: 'open' }
    hrefWithout(BASE, active, 'rating')
    expect(active).toEqual({ rating: 'critical', state: 'open' })
  })
})

describe('buildFilterChips', () => {
  const labels = {
    'rating:critical': 'Kritisch (≤ 2)',
    'state:open': 'Nur offen',
  }

  it('makes one removable chip per set filter', () => {
    const chips = buildFilterChips(BASE, { rating: 'critical', state: 'open' }, labels)

    expect(chips.map((c) => c.key)).toEqual(['rating', 'state'])
    expect(chips[0]?.label).toBe('Kritisch (≤ 2)')
    // Das „×" führt auf dieselbe Ansicht OHNE diesen einen Filter — der andere bleibt stehen.
    expect(chips[0]?.href).toBe(`${BASE}?state=open`)
    expect(chips[1]?.href).toBe(`${BASE}?rating=critical`)
  })

  it('produces nothing when no filter is set', () => {
    expect(buildFilterChips(BASE, { rating: undefined, state: undefined }, labels)).toEqual([])
  })

  it('shows the raw value rather than swallowing an unknown filter', () => {
    // Ein unsichtbarer aktiver Filter ist schlimmer als ein hässlicher Chip: die Liste sähe
    // ohne erkennbaren Grund unvollständig aus.
    const chips = buildFilterChips(BASE, { campaign: 'evt-1' }, labels)
    expect(chips).toHaveLength(1)
    expect(chips[0]?.label).toBe('campaign: evt-1')
  })
})
