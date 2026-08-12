import { describe, expect, it } from 'vitest'

import {
  DEFAULT_MEDIA_FILTERS,
  applyMediaFilters,
  hasActiveMediaFilters,
  matchesKind,
  matchesState,
  mediaKind,
  parseMediaFilters,
  sortMedia,
} from '@/lib/dashboard/media-filters'
import type { MediaItemLike } from '@/lib/dashboard/media-filters'
import { ALLOWED_MIME_TYPES } from '@/lib/validation/schemas'

const EVENT_A = '11111111-1111-4111-8111-111111111111'
const EVENT_B = '22222222-2222-4222-8222-222222222222'

function item(over: Partial<MediaItemLike> = {}): MediaItemLike {
  return {
    eventId: EVENT_A,
    fileType: 'image/jpeg',
    blocked: false,
    uploadedAt: '2026-08-01T10:00:00.000Z',
    ...over,
  }
}

describe('mediaKind', () => {
  it('classifies every allowed upload type', () => {
    expect(mediaKind('image/jpeg')).toBe('photo')
    expect(mediaKind('image/png')).toBe('photo')
    expect(mediaKind('video/mp4')).toBe('video')
    expect(mediaKind('video/quicktime')).toBe('video')
  })

  // Bindet die Gattungserkennung an die tatsächliche Upload-Allowlist: wird dort ein Typ
  // ergänzt, der weder image/ noch video/ ist, schlägt dieser Test fehl.
  it('leaves no allowed MIME type unclassified', () => {
    for (const mime of ALLOWED_MIME_TYPES) {
      expect(mediaKind(mime)).not.toBe('unknown')
    }
  })

  it('treats missing or foreign types as unknown', () => {
    expect(mediaKind(null)).toBe('unknown')
    expect(mediaKind('')).toBe('unknown')
    expect(mediaKind('application/pdf')).toBe('unknown')
  })
})

describe('parseMediaFilters', () => {
  it('defaults an empty query', () => {
    expect(parseMediaFilters({})).toEqual(DEFAULT_MEDIA_FILTERS)
    expect(parseMediaFilters(undefined)).toEqual(DEFAULT_MEDIA_FILTERS)
  })

  it('accepts valid values', () => {
    expect(
      parseMediaFilters({ campaign: EVENT_B, kind: 'video', state: 'blocked', sort: 'oldest' }),
    ).toEqual({ campaign: EVENT_B, kind: 'video', state: 'blocked', sort: 'oldest' })
  })

  it('falls back instead of throwing on garbage', () => {
    expect(parseMediaFilters({ campaign: 'nope', kind: 'gif', state: 7, sort: 'random' })).toEqual(
      DEFAULT_MEDIA_FILTERS,
    )
  })
})

describe('hasActiveMediaFilters', () => {
  it('is false only for the default set', () => {
    expect(hasActiveMediaFilters(DEFAULT_MEDIA_FILTERS)).toBe(false)
    expect(hasActiveMediaFilters({ ...DEFAULT_MEDIA_FILTERS, kind: 'photo' })).toBe(true)
    expect(hasActiveMediaFilters({ ...DEFAULT_MEDIA_FILTERS, state: 'blocked' })).toBe(true)
    expect(hasActiveMediaFilters({ ...DEFAULT_MEDIA_FILTERS, sort: 'oldest' })).toBe(true)
    expect(hasActiveMediaFilters({ ...DEFAULT_MEDIA_FILTERS, campaign: EVENT_A })).toBe(true)
  })
})

describe('matchesKind', () => {
  it('separates photos from videos', () => {
    expect(matchesKind('image/png', 'photo')).toBe(true)
    expect(matchesKind('video/mp4', 'photo')).toBe(false)
    expect(matchesKind('video/mp4', 'video')).toBe(true)
  })

  // Sonst zählte dieselbe Datei unter beiden Gattungen.
  it('excludes unknown types from both kind filters', () => {
    expect(matchesKind(null, 'photo')).toBe(false)
    expect(matchesKind(null, 'video')).toBe(false)
    expect(matchesKind(null, 'all')).toBe(true)
  })
})

describe('matchesState', () => {
  it('splits released from blocked', () => {
    expect(matchesState(false, 'released')).toBe(true)
    expect(matchesState(true, 'released')).toBe(false)
    expect(matchesState(true, 'blocked')).toBe(true)
    expect(matchesState(true, 'all')).toBe(true)
  })
})

describe('applyMediaFilters', () => {
  const items = [
    item({ fileType: 'image/jpeg', blocked: false }),
    item({ fileType: 'video/mp4', blocked: false }),
    item({ fileType: 'image/png', blocked: true }),
    item({ eventId: EVENT_B, fileType: 'image/jpeg', blocked: false }),
  ]

  it('returns everything by default', () => {
    expect(applyMediaFilters(items, DEFAULT_MEDIA_FILTERS)).toHaveLength(4)
  })

  it('combines campaign, kind and state as AND', () => {
    const result = applyMediaFilters(items, {
      ...DEFAULT_MEDIA_FILTERS,
      campaign: EVENT_A,
      kind: 'photo',
      state: 'released',
    })
    expect(result).toHaveLength(1)
    expect(result[0]?.fileType).toBe('image/jpeg')
  })

  it('isolates blocked media for the moderation queue', () => {
    const result = applyMediaFilters(items, { ...DEFAULT_MEDIA_FILTERS, state: 'blocked' })
    expect(result).toHaveLength(1)
    expect(result[0]?.blocked).toBe(true)
  })

  it('does not mutate the input', () => {
    const snapshot = [...items]
    applyMediaFilters(items, { ...DEFAULT_MEDIA_FILTERS, kind: 'video' })
    expect(items).toEqual(snapshot)
  })
})

describe('sortMedia', () => {
  const older = item({ uploadedAt: '2026-08-01T00:00:00.000Z' })
  const newer = item({ uploadedAt: '2026-08-05T00:00:00.000Z' })

  it('orders newest and oldest first', () => {
    expect(sortMedia([older, newer], 'recent')[0]).toEqual(newer)
    expect(sortMedia([older, newer], 'oldest')[0]).toEqual(older)
  })

  it('does not mutate the input array', () => {
    const input = [older, newer]
    const snapshot = [...input]
    sortMedia(input, 'oldest')
    expect(input).toEqual(snapshot)
  })

  it('handles a missing timestamp without NaN ordering', () => {
    const noTime = item({ uploadedAt: null })
    expect(sortMedia([noTime, newer], 'recent')[0]).toEqual(newer)
    expect(sortMedia([noTime, newer], 'oldest')[0]).toEqual(noTime)
  })
})
