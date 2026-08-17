import { describe, expect, it } from 'vitest'

import {
  DEFAULT_EXPERIENCE_FILTERS,
  EXPERIENCE_FIRST_DIR,
  applyExperienceFilters,
  hasActiveExperienceFilters,
  matchesState,
  parseExperienceFilters,
  sortExperiences,
} from '@/lib/dashboard/experience-filters'
import type { ExperienceLike } from '@/lib/dashboard/experience-filters'

function exp(over: Partial<ExperienceLike> = {}): ExperienceLike {
  return { name: 'Sommer', date: '2026-08-01', archived: false, responses: 10, ...over }
}

describe('parseExperienceFilters', () => {
  // Archivierte Kampagnen sind bewusst weggeräumt — sie dürfen nicht per Default zurückkommen.
  it('defaults to active-only, newest first', () => {
    expect(parseExperienceFilters({})).toEqual({ state: 'active', sort: 'date', dir: 'desc' })
    expect(parseExperienceFilters(undefined)).toEqual(DEFAULT_EXPERIENCE_FILTERS)
  })

  it('accepts valid values', () => {
    expect(parseExperienceFilters({ state: 'archived', sort: 'name', dir: 'desc' })).toEqual({
      state: 'archived',
      sort: 'name',
      dir: 'desc',
    })
  })

  // Eine von Hand getippte Adresse soll das Naheliegende bedeuten: `?sort=name` ist A–Z, nicht
  // Z–A. Deshalb fällt die Richtung auf die Erstrichtung des SCHLÜSSELS zurück, nicht auf 'desc'.
  it('derives the direction from the key when the address has none', () => {
    expect(parseExperienceFilters({ sort: 'name' }).dir).toBe('asc')
    expect(parseExperienceFilters({ sort: 'date' }).dir).toBe('desc')
    expect(parseExperienceFilters({ sort: 'responses' }).dir).toBe('desc')
    expect(EXPERIENCE_FIRST_DIR.name).toBe('asc')
  })

  it('keeps an explicit direction, including the unusual one', () => {
    expect(parseExperienceFilters({ sort: 'name', dir: 'desc' }).dir).toBe('desc')
    expect(parseExperienceFilters({ sort: 'date', dir: 'asc' }).dir).toBe('asc')
  })

  it('ignores a garbage direction instead of throwing', () => {
    expect(parseExperienceFilters({ sort: 'name', dir: 'sideways' }).dir).toBe('asc')
  })

  it('falls back instead of throwing on garbage', () => {
    expect(parseExperienceFilters({ state: 'deleted', sort: 42 })).toEqual(
      DEFAULT_EXPERIENCE_FILTERS,
    )
  })
})

describe('hasActiveExperienceFilters', () => {
  it('is false only for the default set', () => {
    expect(hasActiveExperienceFilters(DEFAULT_EXPERIENCE_FILTERS)).toBe(false)
    expect(hasActiveExperienceFilters({ state: 'all', sort: 'date', dir: 'desc' })).toBe(true)
    expect(hasActiveExperienceFilters({ state: 'active', sort: 'name', dir: 'asc' })).toBe(true)
    // Auch eine gedrehte Richtung ist eine Abweichung — sonst behauptete „Zurücksetzen" nichts
    // zu tun, während die Liste umgekehrt sortiert dasteht.
    expect(hasActiveExperienceFilters({ state: 'active', sort: 'date', dir: 'asc' })).toBe(true)
  })
})

describe('matchesState', () => {
  it('splits active from archived', () => {
    expect(matchesState(false, 'active')).toBe(true)
    expect(matchesState(true, 'active')).toBe(false)
    expect(matchesState(true, 'archived')).toBe(true)
    expect(matchesState(false, 'archived')).toBe(false)
    expect(matchesState(true, 'all')).toBe(true)
    expect(matchesState(false, 'all')).toBe(true)
  })
})

describe('applyExperienceFilters', () => {
  const items = [exp({ name: 'A' }), exp({ name: 'B', archived: true }), exp({ name: 'C' })]

  it('hides archived entries by default', () => {
    const result = applyExperienceFilters(items, DEFAULT_EXPERIENCE_FILTERS)
    expect(result.map((i) => i.name)).toEqual(['A', 'C'])
  })

  it('can show only archived', () => {
    const result = applyExperienceFilters(items, { state: 'archived', sort: 'date', dir: 'desc' })
    expect(result.map((i) => i.name)).toEqual(['B'])
  })

  it('can show everything', () => {
    expect(applyExperienceFilters(items, { state: 'all', sort: 'date', dir: 'desc' })).toHaveLength(
      3,
    )
  })

  it('does not mutate the input', () => {
    const snapshot = [...items]
    applyExperienceFilters(items, { state: 'archived', sort: 'date', dir: 'desc' })
    expect(items).toEqual(snapshot)
  })
})

describe('sortExperiences', () => {
  const a = exp({ name: 'Zermatt', date: '2026-01-01', responses: 5 })
  const b = exp({ name: 'Älpli', date: '2026-09-01', responses: 50 })
  const c = exp({ name: 'Meran', date: '2026-05-01', responses: 20 })

  it('orders by date, newest first', () => {
    expect(sortExperiences([a, b, c], 'date').map((i) => i.name)).toEqual([
      'Älpli',
      'Meran',
      'Zermatt',
    ])
  })

  it('orders by response count, busiest first', () => {
    expect(sortExperiences([a, b, c], 'responses').map((i) => i.responses)).toEqual([50, 20, 5])
  })

  // Naives Sortieren stellte „Älpli" hinter „Zermatt" — localeCompare('de') reiht Umlaute ein.
  it('sorts names with German collation', () => {
    expect(sortExperiences([a, b, c], 'name').map((i) => i.name)).toEqual([
      'Älpli',
      'Meran',
      'Zermatt',
    ])
  })

  it('does not mutate the input array', () => {
    const input = [a, b, c]
    const snapshot = [...input]
    sortExperiences(input, 'name')
    expect(input).toEqual(snapshot)
  })

  // Die Richtung ist neu: vorher war jeder Schlüssel an eine feste Ordnung geknüpft, die älteste
  // Kampagne oder Z–A war nicht erreichbar.
  it('turns every key around on request', () => {
    expect(sortExperiences([a, b, c], 'date', 'asc').map((i) => i.name)).toEqual([
      'Zermatt',
      'Meran',
      'Älpli',
    ])
    expect(sortExperiences([a, b, c], 'responses', 'asc').map((i) => i.responses)).toEqual([
      5, 20, 50,
    ])
    expect(sortExperiences([a, b, c], 'name', 'desc').map((i) => i.name)).toEqual([
      'Zermatt',
      'Meran',
      'Älpli',
    ])
  })

  // Ohne Richtung gilt weiterhin die Erstrichtung des Schlüssels — das erhält das Verhalten von
  // vor der Änderung (Datum neueste zuerst, Name A–Z).
  it('falls back to the first direction of the key', () => {
    for (const key of ['date', 'responses', 'name'] as const) {
      expect(sortExperiences([a, b, c], key).map((i) => i.name)).toEqual(
        sortExperiences([a, b, c], key, EXPERIENCE_FIRST_DIR[key]).map((i) => i.name),
      )
    }
  })
})
