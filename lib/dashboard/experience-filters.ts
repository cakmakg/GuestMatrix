/**
 * Filter der Experiences-Liste (Aufenthalte / Reisen / Feiern — die Benennung kommt aus
 * `resolveDashboardLabels`, siehe lib/sectors).
 *
 * Gleiches Muster wie Feedback- und Medien-Liste: GET-Formular, `.catch()` statt Ausnahme.
 */

import { z } from 'zod'

import { SORT_DIR_TUPLE, type SortDir, withDir } from './sort'

export const EXPERIENCE_STATE_TUPLE = ['active', 'archived', 'all'] as const
export const EXPERIENCE_SORT_TUPLE = ['date', 'responses', 'name'] as const

export type ExperienceState = (typeof EXPERIENCE_STATE_TUPLE)[number]
export type ExperienceSort = (typeof EXPERIENCE_SORT_TUPLE)[number]

/**
 * Richtung beim ERSTEN Klick auf eine Spalte. Eine Aussage über die Spalte, nicht über den
 * Zustand — und zugleich die Rückfallrichtung für eine Adresse ohne `dir` (siehe Schema).
 */
export const EXPERIENCE_FIRST_DIR: Record<ExperienceSort, SortDir> = {
  date: 'desc',
  responses: 'desc',
  name: 'asc',
}

/**
 * Standard ist `active`, nicht `all`: archivierte Kampagnen sind bewusst weggeräumt und
 * sollen die Arbeitsliste nicht wieder füllen.
 *
 * `dir` ist optional und fällt auf die Erstrichtung des Schlüssels zurück, nicht auf einen festen
 * Wert. Damit bedeutet `?sort=name` von Hand getippt „A–Z" und nicht „Z–A" — die Adresse bleibt
 * lesbar, und die Kopfzeile muss die Richtung nur mitschicken, wenn sie vom Naheliegenden abweicht.
 */
export const experienceFilterSchema = z
  .object({
    state: z.enum(EXPERIENCE_STATE_TUPLE).catch('active'),
    sort: z.enum(EXPERIENCE_SORT_TUPLE).catch('date'),
    dir: z.enum(SORT_DIR_TUPLE).optional().catch(undefined),
  })
  .transform(({ state, sort, dir }) => ({ state, sort, dir: dir ?? EXPERIENCE_FIRST_DIR[sort] }))

export type ExperienceFilters = z.infer<typeof experienceFilterSchema>

export const DEFAULT_EXPERIENCE_FILTERS: ExperienceFilters = {
  state: 'active',
  sort: 'date',
  dir: EXPERIENCE_FIRST_DIR.date,
}

export function parseExperienceFilters(input: unknown): ExperienceFilters {
  return experienceFilterSchema.parse(input ?? {})
}

export function hasActiveExperienceFilters(filters: ExperienceFilters): boolean {
  return (
    filters.state !== DEFAULT_EXPERIENCE_FILTERS.state ||
    filters.sort !== DEFAULT_EXPERIENCE_FILTERS.sort ||
    filters.dir !== DEFAULT_EXPERIENCE_FILTERS.dir
  )
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

/**
 * Ein AUFSTEIGENDER Komparator je Schlüssel; die Richtung dreht `withDir`. Zwei Komparatoren je
 * Spalte würden über kurz oder lang auseinanderdriften — etwa, wenn nur einer die Umlaute
 * einreiht.
 */
const EXPERIENCE_COMPARATORS: Record<
  ExperienceSort,
  (a: ExperienceLike, b: ExperienceLike) => number
> = {
  responses: (a, b) => a.responses - b.responses,
  // Deutsche Sortierung: Umlaute einreihen statt hinten anhängen.
  name: (a, b) => a.name.localeCompare(b.name, 'de'),
  date: (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
}

/** Sortiert eine Kopie; die Eingabe bleibt unberührt. */
export function sortExperiences<T extends ExperienceLike>(
  items: readonly T[],
  order: ExperienceSort,
  dir: SortDir = EXPERIENCE_FIRST_DIR[order],
): T[] {
  const compare = EXPERIENCE_COMPARATORS[order]
  return [...items].sort((a, b) => withDir(compare(a, b), dir))
}
