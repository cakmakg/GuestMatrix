/**
 * Filter der kampagnenübergreifenden Medien-Bibliothek.
 *
 * Wie bei der Feedback-Liste reisen die Filter als `searchParams` (GET-Formular, kein
 * Client-JavaScript) und fallen bei Unsinn per `.catch()` auf ihren Standard zurück.
 *
 * Rein (keine DB, kein Storage): die Seite lädt die Zeilen und signiert die URLs,
 * diese Funktionen ordnen sie.
 */

import { z } from 'zod'

export const MEDIA_KIND_TUPLE = ['all', 'photo', 'video'] as const
export const MEDIA_STATE_TUPLE = ['all', 'released', 'blocked'] as const
export const MEDIA_SORT_TUPLE = ['recent', 'oldest'] as const

export type MediaKindFilter = (typeof MEDIA_KIND_TUPLE)[number]
export type MediaStateFilter = (typeof MEDIA_STATE_TUPLE)[number]
export type MediaSort = (typeof MEDIA_SORT_TUPLE)[number]

/** Was in einer Datei steckt, abgeleitet aus dem MIME-Typ (`submissions.file_type`). */
export type MediaKind = 'photo' | 'video' | 'unknown'

export const mediaFilterSchema = z.object({
  campaign: z.string().uuid().optional().catch(undefined),
  kind: z.enum(MEDIA_KIND_TUPLE).catch('all'),
  state: z.enum(MEDIA_STATE_TUPLE).catch('all'),
  sort: z.enum(MEDIA_SORT_TUPLE).catch('recent'),
})

export type MediaFilters = z.infer<typeof mediaFilterSchema>

export const DEFAULT_MEDIA_FILTERS: MediaFilters = {
  campaign: undefined,
  kind: 'all',
  state: 'all',
  sort: 'recent',
}

export function parseMediaFilters(input: unknown): MediaFilters {
  return mediaFilterSchema.parse(input ?? {})
}

export function hasActiveMediaFilters(filters: MediaFilters): boolean {
  return (
    filters.campaign !== undefined ||
    filters.kind !== 'all' ||
    filters.state !== 'all' ||
    filters.sort !== 'recent'
  )
}

/**
 * MIME-Typ → Gattung. Ein fehlender oder unbekannter Typ ist `unknown` und wird von den
 * Gattungsfiltern NICHT eingeschlossen — sonst tauchte eine Datei unbekannter Art sowohl
 * unter „Fotos" als auch unter „Videos" auf.
 */
export function mediaKind(fileType: string | null): MediaKind {
  if (!fileType) return 'unknown'
  if (fileType.startsWith('image/')) return 'photo'
  if (fileType.startsWith('video/')) return 'video'
  return 'unknown'
}

export type MediaItemLike = {
  eventId: string
  fileType: string | null
  blocked: boolean
  uploadedAt: string | null
}

export function matchesKind(fileType: string | null, filter: MediaKindFilter): boolean {
  if (filter === 'all') return true
  return mediaKind(fileType) === filter
}

export function matchesState(blocked: boolean, filter: MediaStateFilter): boolean {
  if (filter === 'all') return true
  return filter === 'blocked' ? blocked : !blocked
}

export function applyMediaFilters<T extends MediaItemLike>(
  items: readonly T[],
  filters: MediaFilters,
): T[] {
  return items.filter(
    (item) =>
      (filters.campaign === undefined || item.eventId === filters.campaign) &&
      matchesKind(item.fileType, filters.kind) &&
      matchesState(item.blocked, filters.state),
  )
}

function timeOf(value: string | null): number {
  return value === null ? 0 : new Date(value).getTime()
}

/** Sortiert eine Kopie; die Eingabe bleibt unberührt. */
export function sortMedia<T extends MediaItemLike>(items: readonly T[], order: MediaSort): T[] {
  const copy = [...items]
  return copy.sort((a, b) =>
    order === 'recent'
      ? timeOf(b.uploadedAt) - timeOf(a.uploadedAt)
      : timeOf(a.uploadedAt) - timeOf(b.uploadedAt),
  )
}
