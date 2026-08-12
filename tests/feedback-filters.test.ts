import { describe, expect, it } from 'vitest'

import {
  DEFAULT_FILTERS,
  applyFeedbackFilters,
  hasActiveFilters,
  matchesMedia,
  matchesRating,
  parseFeedbackFilters,
  sortFeedback,
} from '@/lib/dashboard/feedback-filters'
import type { FeedbackItemLike } from '@/lib/dashboard/feedback-filters'

const EVENT_A = '11111111-1111-4111-8111-111111111111'
const EVENT_B = '22222222-2222-4222-8222-222222222222'

function item(over: Partial<FeedbackItemLike> = {}): FeedbackItemLike {
  return {
    eventId: EVENT_A,
    rating: 5,
    hasMedia: false,
    uploadedAt: '2026-08-01T10:00:00.000Z',
    ...over,
  }
}

describe('parseFeedbackFilters', () => {
  it('defaults an empty query to no filtering', () => {
    expect(parseFeedbackFilters({})).toEqual(DEFAULT_FILTERS)
    expect(parseFeedbackFilters(undefined)).toEqual(DEFAULT_FILTERS)
  })

  it('accepts valid values', () => {
    expect(
      parseFeedbackFilters({
        campaign: EVENT_A,
        rating: 'critical',
        media: 'with',
        sort: 'lowest',
      }),
    ).toEqual({ campaign: EVENT_A, rating: 'critical', media: 'with', sort: 'lowest' })
  })

  // Eine handeditierte URL darf keine Fehlerseite erzeugen.
  it('falls back to defaults instead of throwing on garbage', () => {
    expect(
      parseFeedbackFilters({
        campaign: 'not-a-uuid',
        rating: 'bogus',
        media: 42,
        sort: null,
      }),
    ).toEqual(DEFAULT_FILTERS)
  })

  it('treats a non-uuid campaign as no campaign filter', () => {
    expect(parseFeedbackFilters({ campaign: 'all' }).campaign).toBeUndefined()
    expect(parseFeedbackFilters({ campaign: '' }).campaign).toBeUndefined()
  })
})

describe('hasActiveFilters', () => {
  it('is false for the default set', () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false)
  })

  it('is true as soon as anything deviates', () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, rating: 'critical' })).toBe(true)
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, campaign: EVENT_A })).toBe(true)
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, media: 'without' })).toBe(true)
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, sort: 'lowest' })).toBe(true)
  })
})

describe('matchesRating', () => {
  it('splits the scale into critical / neutral / positive', () => {
    expect([1, 2, 3, 4, 5].filter((r) => matchesRating(r, 'critical'))).toEqual([1, 2])
    expect([1, 2, 3, 4, 5].filter((r) => matchesRating(r, 'neutral'))).toEqual([3])
    expect([1, 2, 3, 4, 5].filter((r) => matchesRating(r, 'positive'))).toEqual([4, 5])
  })

  it('never counts an unrated entry as critical', () => {
    expect(matchesRating(null, 'critical')).toBe(false)
    expect(matchesRating(null, 'neutral')).toBe(false)
    expect(matchesRating(null, 'positive')).toBe(false)
    expect(matchesRating(null, 'unrated')).toBe(true)
  })

  it('lets everything through on "all"', () => {
    expect(matchesRating(null, 'all')).toBe(true)
    expect(matchesRating(3, 'all')).toBe(true)
  })
})

describe('matchesMedia', () => {
  it('separates entries with and without media', () => {
    expect(matchesMedia(true, 'with')).toBe(true)
    expect(matchesMedia(false, 'with')).toBe(false)
    expect(matchesMedia(false, 'without')).toBe(true)
    expect(matchesMedia(true, 'all')).toBe(true)
  })
})

describe('applyFeedbackFilters', () => {
  const items = [
    item({ rating: 1, hasMedia: true }),
    item({ rating: 5, hasMedia: false }),
    item({ eventId: EVENT_B, rating: 2, hasMedia: false }),
    item({ rating: null, hasMedia: true }),
  ]

  it('returns everything under the default filters', () => {
    expect(applyFeedbackFilters(items, DEFAULT_FILTERS)).toHaveLength(4)
  })

  it('combines campaign, rating and media as AND', () => {
    const result = applyFeedbackFilters(items, {
      ...DEFAULT_FILTERS,
      campaign: EVENT_A,
      rating: 'critical',
      media: 'with',
    })
    expect(result).toHaveLength(1)
    expect(result[0]?.rating).toBe(1)
  })

  it('scopes to one campaign', () => {
    const result = applyFeedbackFilters(items, { ...DEFAULT_FILTERS, campaign: EVENT_B })
    expect(result).toHaveLength(1)
    expect(result[0]?.eventId).toBe(EVENT_B)
  })

  it('can isolate unrated entries', () => {
    const result = applyFeedbackFilters(items, { ...DEFAULT_FILTERS, rating: 'unrated' })
    expect(result).toHaveLength(1)
    expect(result[0]?.rating).toBeNull()
  })

  it('does not mutate the input', () => {
    const original = [...items]
    applyFeedbackFilters(items, { ...DEFAULT_FILTERS, rating: 'critical' })
    expect(items).toEqual(original)
  })
})

describe('sortFeedback', () => {
  const a = item({ rating: 4, uploadedAt: '2026-08-01T00:00:00.000Z' })
  const b = item({ rating: 1, uploadedAt: '2026-08-03T00:00:00.000Z' })
  const c = item({ rating: 5, uploadedAt: '2026-08-02T00:00:00.000Z' })

  it('orders by newest first', () => {
    expect(sortFeedback([a, b, c], 'recent').map((i) => i.uploadedAt)).toEqual([
      '2026-08-03T00:00:00.000Z',
      '2026-08-02T00:00:00.000Z',
      '2026-08-01T00:00:00.000Z',
    ])
  })

  it('orders worst first for service recovery', () => {
    expect(sortFeedback([a, b, c], 'lowest').map((i) => i.rating)).toEqual([1, 4, 5])
  })

  it('orders best first', () => {
    expect(sortFeedback([a, b, c], 'highest').map((i) => i.rating)).toEqual([5, 4, 1])
  })

  // Sonst würde ein unbewerteter Galerie-Beitrag die kritische Liste anführen.
  it('pushes unrated entries to the end of both rating sorts', () => {
    const unrated = item({ rating: null, uploadedAt: '2026-08-09T00:00:00.000Z' })
    expect(sortFeedback([unrated, a, b], 'lowest').map((i) => i.rating)).toEqual([1, 4, null])
    expect(sortFeedback([unrated, a, b], 'highest').map((i) => i.rating)).toEqual([4, 1, null])
  })

  it('falls back to newest-first among unrated entries', () => {
    const older = item({ rating: null, uploadedAt: '2026-08-01T00:00:00.000Z' })
    const newer = item({ rating: null, uploadedAt: '2026-08-05T00:00:00.000Z' })
    expect(sortFeedback([older, newer], 'lowest').map((i) => i.uploadedAt)).toEqual([
      '2026-08-05T00:00:00.000Z',
      '2026-08-01T00:00:00.000Z',
    ])
  })

  it('does not mutate the input array', () => {
    const input = [a, b, c]
    const snapshot = [...input]
    sortFeedback(input, 'lowest')
    expect(input).toEqual(snapshot)
  })

  it('handles a missing timestamp without NaN ordering', () => {
    const noTime = item({ rating: null, uploadedAt: null })
    expect(sortFeedback([noTime, a], 'recent')).toHaveLength(2)
    expect(sortFeedback([noTime, a], 'recent')[0]).toEqual(a)
  })
})
