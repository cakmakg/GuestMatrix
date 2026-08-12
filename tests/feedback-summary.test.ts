import { describe, expect, it } from 'vitest'

import {
  answeredQuestions,
  average,
  negativeShare,
  parseAnswers,
  ratingDistribution,
  summarizeDimensions,
  weakestDimension,
} from '@/lib/dashboard/feedback-summary'
import type { FeedbackQuestion } from '@/lib/sectors'
import { allowedCampaignTypes, getFeedbackQuestions } from '@/lib/sectors'

const STAY_QUESTIONS: FeedbackQuestion[] = [
  { id: 'cleanliness', prompt: 'Sauberkeit', type: 'rating' },
  { id: 'service', prompt: 'Personal & Service', type: 'rating' },
]

describe('parseAnswers', () => {
  it('keeps numbers and strings from a flat object', () => {
    expect(parseAnswers({ cleanliness: 5, note: 'gut' })).toEqual({ cleanliness: 5, note: 'gut' })
  })

  it('drops nested and non-scalar values', () => {
    expect(parseAnswers({ ok: 4, nested: { a: 1 }, list: [1, 2], flag: true })).toEqual({ ok: 4 })
  })

  it('treats non-objects as empty rather than throwing', () => {
    expect(parseAnswers(null)).toEqual({})
    expect(parseAnswers(undefined)).toEqual({})
    expect(parseAnswers('text')).toEqual({})
    expect(parseAnswers(42)).toEqual({})
    expect(parseAnswers([1, 2, 3])).toEqual({})
  })
})

describe('summarizeDimensions', () => {
  it('averages each rating question independently', () => {
    const sets = [
      { cleanliness: 5, service: 3 },
      { cleanliness: 4, service: 1 },
    ]
    const result = summarizeDimensions(sets, STAY_QUESTIONS)

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ id: 'cleanliness', average: 4.5, responses: 2 })
    expect(result[1]).toMatchObject({ id: 'service', average: 2, responses: 2 })
  })

  it('keeps an unanswered question visible with average null, not zero', () => {
    const result = summarizeDimensions([{ cleanliness: 5 }], STAY_QUESTIONS)
    expect(result[1]).toMatchObject({ id: 'service', average: null, responses: 0 })
  })

  it('preserves catalog order even when answers arrive in another order', () => {
    const result = summarizeDimensions([{ service: 2, cleanliness: 4 }], STAY_QUESTIONS)
    expect(result.map((r) => r.id)).toEqual(['cleanliness', 'service'])
  })

  it('ignores answer keys that are no longer in the catalog', () => {
    const result = summarizeDimensions([{ cleanliness: 5, retired_key: 1 }], STAY_QUESTIONS)
    expect(result.map((r) => r.id)).toEqual(['cleanliness', 'service'])
  })

  it('excludes text questions — they have no average', () => {
    const questions: FeedbackQuestion[] = [
      ...STAY_QUESTIONS,
      { id: 'words', prompt: 'Drei Worte', type: 'text', maxLength: 60 },
    ]
    const result = summarizeDimensions([{ words: 'schön', cleanliness: 5 }], questions)
    expect(result.map((r) => r.id)).toEqual(['cleanliness', 'service'])
  })

  it('ignores a string value sitting on a rating question', () => {
    const result = summarizeDimensions([{ cleanliness: 'fünf' }], STAY_QUESTIONS)
    expect(result[0]).toMatchObject({ average: null, responses: 0 })
  })

  it('returns an empty report for an empty catalog', () => {
    expect(summarizeDimensions([{ a: 1 }], [])).toEqual([])
  })
})

describe('ratingDistribution', () => {
  it('counts stars into five buckets, 1 star first', () => {
    expect(ratingDistribution([1, 3, 3, 5])).toEqual([1, 0, 2, 0, 1])
  })

  it('ignores out-of-range values', () => {
    expect(ratingDistribution([0, 6, -1, 4])).toEqual([0, 0, 0, 1, 0])
  })

  it('returns all zeros for no ratings', () => {
    expect(ratingDistribution([])).toEqual([0, 0, 0, 0, 0])
  })
})

describe('average', () => {
  it('averages and reports null for nothing', () => {
    expect(average([2, 4])).toBe(3)
    expect(average([])).toBeNull()
  })
})

describe('negativeShare', () => {
  it('is the inclusive share at or below the threshold', () => {
    expect(negativeShare([1, 2, 5, 5])).toBe(50)
    expect(negativeShare([5, 5])).toBe(0)
  })

  it('honours a custom threshold', () => {
    expect(negativeShare([1, 2, 3, 4], 3)).toBe(75)
  })

  it('has no share without ratings', () => {
    expect(negativeShare([])).toBeNull()
  })
})

describe('weakestDimension', () => {
  it('picks the lowest average', () => {
    const worst = weakestDimension([
      { id: 'a', prompt: 'A', average: 4.5, responses: 10 },
      { id: 'b', prompt: 'B', average: 3.1, responses: 4 },
    ])
    expect(worst?.id).toBe('b')
  })

  it('skips dimensions without data', () => {
    const worst = weakestDimension([
      { id: 'a', prompt: 'A', average: 4.5, responses: 10 },
      { id: 'b', prompt: 'B', average: null, responses: 0 },
    ])
    expect(worst?.id).toBe('a')
  })

  it('respects a minimum sample size', () => {
    const summaries = [
      { id: 'a', prompt: 'A', average: 4.5, responses: 10 },
      { id: 'b', prompt: 'B', average: 1.0, responses: 1 },
    ]
    expect(weakestDimension(summaries, 5)?.id).toBe('a')
  })

  it('returns null when nothing qualifies', () => {
    expect(weakestDimension([])).toBeNull()
    expect(weakestDimension([{ id: 'a', prompt: 'A', average: null, responses: 0 }])).toBeNull()
  })
})

// Der Bericht steht und fällt mit dem Registry-Katalog — wird er leer, zeigt die Seite nichts.
describe('registry wiring for the report', () => {
  it('hotel tenants resolve to the four stay dimensions', () => {
    const types = allowedCampaignTypes('tourism', 'hotel')
    const ids = types.flatMap((type) => getFeedbackQuestions(type).map((q) => q.id))
    expect(ids).toEqual(['cleanliness', 'service', 'location', 'value'])
  })

  it('agency tenants resolve to the four agency dimensions', () => {
    const types = allowedCampaignTypes('tourism', 'agency')
    const ids = types.flatMap((type) => getFeedbackQuestions(type).map((q) => q.id))
    expect(ids).toEqual(['experience', 'organization', 'service', 'value'])
  })

  it('every resolved question is a rating question, so each gets an average', () => {
    for (const businessType of ['hotel', 'agency'] as const) {
      const types = allowedCampaignTypes('tourism', businessType)
      const questions = types.flatMap((type) => getFeedbackQuestions(type))
      expect(questions.length).toBeGreaterThan(0)
      expect(questions.every((q) => q.type === 'rating')).toBe(true)
    }
  })
})

describe('answeredQuestions', () => {
  const CATALOG = [
    { id: 'cleanliness', prompt: 'Sauberkeit', type: 'rating' as const },
    { id: 'three_words', prompt: 'Drei Worte', type: 'text' as const, maxLength: 60 },
  ]

  // Regression: die Antwortliste filterte auf `typeof === 'number'` und verschluckte damit die
  // einzige strukturierte Frage des Hochzeits-Gästebuchs.
  it('keeps text answers, not just numeric ones', () => {
    const answered = answeredQuestions({ three_words: 'laut, schön, lang' }, CATALOG)
    expect(answered.map((q) => q.id)).toEqual(['three_words'])
  })

  it('keeps numeric answers', () => {
    expect(answeredQuestions({ cleanliness: 5 }, CATALOG).map((q) => q.id)).toEqual(['cleanliness'])
  })

  it('preserves catalog order regardless of answer order', () => {
    const answered = answeredQuestions({ three_words: 'a b c', cleanliness: 4 }, CATALOG)
    expect(answered.map((q) => q.id)).toEqual(['cleanliness', 'three_words'])
  })

  it('treats a blank text answer as unanswered', () => {
    expect(answeredQuestions({ three_words: '   ' }, CATALOG)).toEqual([])
  })

  it('ignores answers whose key is not in the catalog', () => {
    expect(answeredQuestions({ vanished_key: 3 }, CATALOG)).toEqual([])
  })
})
