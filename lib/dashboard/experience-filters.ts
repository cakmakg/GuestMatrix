/**
 * Filter der Experiences-Liste (Aufenthalte / Reisen / Feiern — die Benennung kommt aus
 * `resolveDashboardLabels`, siehe lib/sectors).
 *
 * Gleiches Muster wie Feedback- und Medien-Liste: GET-Formular, `.catch()` statt Ausnahme.
 */

import { z } from 'zod'

export const EXPERIENCE_STATE_TUPLE = ['active', 'archived', 'all'] as const
export const EXPERIENCE_SORT_TUPLE = ['date', 'responses', 'name'] as const

export type ExperienceState = (typeof EXPERIENCE_STATE_TUPLE)[number]
export type ExperienceSort = (typeof EXPERIENCE_SORT_TUPLE)[number]

/**
 * Standard ist `active`, nicht `all`: archivierte Kampagnen sind bewusst weggeräumt und
 * sollen die Arbeitsliste nicht wieder füllen.
 */
export const experienceFilterSchema = z.object({
  state: z.enum(EXPERIENCE_STATE_TUPLE).catch('active'),
  sort: z.enum(EXPERIENCE_SORT_TUPLE).catch('date'),
})

export type ExperienceFilters = z.infer<typeof experienceFilterSchema>

export const DEFAULT_EXPERIENCE_FILTERS: ExperienceFilters = { state: 'active', sort: 'date' }

export function parseExperienceFilters(input: unknown): ExperienceFilters {
  return experienceFilterSchema.parse(input ?? {})
}

export function hasActiveExperienceFilters(filters: ExperienceFilters): boolean {
  return filters.state !== 'active' || filters.sort !== 'date'
}

export type ExperienceLike = {
  name: string
  date: string
  archived: boolean
  responses: number
}

export function matchesState(archived: boolean, filter: ExperienceState): boolean {
  if (filter === 'all') return true
  return filter === 'archived' ? archived : !archived
}

export function applyExperienceFilters<T extends ExperienceLike>(
  items: readonly T[],
  filters: ExperienceFilters,
): T[] {
  return items.filter((item) => matchesState(item.archived, filters.state))
}

/** Sortiert eine Kopie; die Eingabe bleibt unberührt. */
export function sortExperiences<T extends ExperienceLike>(
  items: readonly T[],
  order: ExperienceSort,
): T[] {
  const copy = [...items]

  switch (order) {
    case 'responses':
      return copy.sort((a, b) => b.responses - a.responses)
    case 'name':
      // Deutsche Sortierung: Umlaute einreihen statt hinten anhängen.
      return copy.sort((a, b) => a.name.localeCompare(b.name, 'de'))
    case 'date':
      return copy.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }
}
