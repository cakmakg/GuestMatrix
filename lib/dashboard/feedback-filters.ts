/**
 * Filter und Sortierung der kampagnenübergreifenden Feedback-Liste.
 *
 * Die Filter reisen als `searchParams` (GET-Formular, kein Client-JavaScript). Weil eine
 * URL von Hand editierbar ist, fällt jedes Schema per `.catch()` auf seinen Standard
 * zurück statt zu werfen — ein kaputter Link zeigt die ungefilterte Liste, keine Fehlerseite.
 *
 * Rein (keine DB): die Seite lädt die Zeilen, diese Funktionen ordnen sie.
 */

import { z } from 'zod'

export const RATING_FILTER_TUPLE = ['all', 'critical', 'neutral', 'positive', 'unrated'] as const
export const MEDIA_FILTER_TUPLE = ['all', 'with', 'without'] as const
export const SORT_ORDER_TUPLE = ['recent', 'lowest', 'highest'] as const

export type RatingFilter = (typeof RATING_FILTER_TUPLE)[number]
export type MediaFilter = (typeof MEDIA_FILTER_TUPLE)[number]
export type SortOrder = (typeof SORT_ORDER_TUPLE)[number]

/** Ab wann eine Bewertung als kritisch gilt (inklusiv) — Einstieg in die Service Recovery. */
export const CRITICAL_MAX = 2
/** Ab wann eine Bewertung als positiv gilt (inklusiv). */
export const POSITIVE_MIN = 4

export const feedbackFilterSchema = z.object({
  // Leerer String / „all" / Unsinn → kein Kampagnenfilter.
  campaign: z.string().uuid().optional().catch(undefined),
  rating: z.enum(RATING_FILTER_TUPLE).catch('all'),
  media: z.enum(MEDIA_FILTER_TUPLE).catch('all'),
  sort: z.enum(SORT_ORDER_TUPLE).catch('recent'),
})

export type FeedbackFilters = z.infer<typeof feedbackFilterSchema>

export const DEFAULT_FILTERS: FeedbackFilters = {
  campaign: undefined,
  rating: 'all',
  media: 'all',
  sort: 'recent',
}

export function parseFeedbackFilters(input: unknown): FeedbackFilters {
  return feedbackFilterSchema.parse(input ?? {})
}

/** True, wenn irgendein Filter vom Standard abweicht — steuert den „Zurücksetzen"-Link. */
export function hasActiveFilters(filters: FeedbackFilters): boolean {
  return (
    filters.campaign !== undefined ||
    filters.rating !== 'all' ||
    filters.media !== 'all' ||
    filters.sort !== 'recent'
  )
}

/** Die Mindestform, auf der Filter und Sortierung arbeiten. */
export type FeedbackItemLike = {
  eventId: string
  rating: number | null
  hasMedia: boolean
  uploadedAt: string | null
}

export function matchesRating(rating: number | null, filter: RatingFilter): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'unrated':
      return rating === null
    case 'critical':
      return rating !== null && rating <= CRITICAL_MAX
    case 'positive':
      return rating !== null && rating >= POSITIVE_MIN
    case 'neutral':
      return rating !== null && rating > CRITICAL_MAX && rating < POSITIVE_MIN
  }
}

export function matchesMedia(hasMedia: boolean, filter: MediaFilter): boolean {
  if (filter === 'all') return true
  return filter === 'with' ? hasMedia : !hasMedia
}

export function applyFeedbackFilters<T extends FeedbackItemLike>(
  items: readonly T[],
  filters: FeedbackFilters,
): T[] {
  return items.filter(
    (item) =>
      (filters.campaign === undefined || item.eventId === filters.campaign) &&
      matchesRating(item.rating, filters.rating) &&
      matchesMedia(item.hasMedia, filters.media),
  )
}

function timeOf(value: string | null): number {
  return value === null ? 0 : new Date(value).getTime()
}

/**
 * Sortiert eine Kopie (die Eingabe bleibt unberührt). Unbewertete Beiträge haben keine
 * Note, an der sie gemessen werden könnten — sie landen in beiden Noten-Sortierungen
 * ans Ende, statt als 0 die kritische Liste zu verstopfen.
 */
export function sortFeedback<T extends FeedbackItemLike>(
  items: readonly T[],
  order: SortOrder,
): T[] {
  const copy = [...items]

  if (order === 'recent') {
    return copy.sort((a, b) => timeOf(b.uploadedAt) - timeOf(a.uploadedAt))
  }

  return copy.sort((a, b) => {
    if (a.rating === null && b.rating === null) return timeOf(b.uploadedAt) - timeOf(a.uploadedAt)
    if (a.rating === null) return 1
    if (b.rating === null) return -1
    return order === 'lowest' ? a.rating - b.rating : b.rating - a.rating
  })
}
