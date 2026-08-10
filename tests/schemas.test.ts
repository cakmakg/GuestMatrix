import { describe, expect, it } from 'vitest'

import {
  createEventSchema,
  feedbackSchema,
  guestbookMessageSchema,
  loginSchema,
  moderationSchema,
  presignSchema,
  ratingSchema,
  resetPasswordSchema,
  signupSchema,
} from '@/lib/validation/schemas'

describe('loginSchema', () => {
  it('accepts valid credentials', () => {
    const result = loginSchema.safeParse({ email: 'test@example.com', password: 'password123' })
    expect(result.success).toBe(true)
  })

  it('lowercases email', () => {
    const result = loginSchema.safeParse({ email: 'Test@EXAMPLE.COM', password: 'password123' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.email).toBe('test@example.com')
  })

  it('rejects invalid email', () => {
    expect(loginSchema.safeParse({ email: 'not-an-email', password: 'password123' }).success).toBe(
      false,
    )
  })

  it('rejects password shorter than 8 characters', () => {
    expect(loginSchema.safeParse({ email: 'test@example.com', password: 'short' }).success).toBe(
      false,
    )
  })
})

describe('signupSchema', () => {
  const validBase = {
    email: 'couple@example.com',
    password: 'password123',
    brandName: 'Anna & Ben',
    signupChoice: 'tourism:hotel',
  }

  it('accepts a valid signup with an active business choice', () => {
    expect(signupSchema.safeParse(validBase).success).toBe(true)
    expect(signupSchema.safeParse({ ...validBase, signupChoice: 'tourism:agency' }).success).toBe(
      true,
    )
    // event (0018) hat keine business_type → die Signup-Option ist `event:` (business_type leer).
    expect(signupSchema.safeParse({ ...validBase, signupChoice: 'event:' }).success).toBe(true)
  })

  it('lowercases the email', () => {
    const result = signupSchema.safeParse({ ...validBase, email: 'Couple@Example.COM' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.email).toBe('couple@example.com')
  })

  it('rejects a short password', () => {
    expect(signupSchema.safeParse({ ...validBase, password: 'short' }).success).toBe(false)
  })

  it('rejects a blank brand name', () => {
    expect(signupSchema.safeParse({ ...validBase, brandName: '   ' }).success).toBe(false)
  })

  it('rejects a missing choice', () => {
    expect(
      signupSchema.safeParse({
        email: validBase.email,
        password: validBase.password,
        brandName: validBase.brandName,
      }).success,
    ).toBe(false)
  })

  it('rejects a raw tourism sector value (must carry a business_type; event carries none)', () => {
    // `event:` ist gültig (kein business_type), aber `tourism`/`tourism:` NICHT (tourism verlangt
    // hotel|agency), und `real_estate:` bleibt gesperrt (Sektor nicht aktiv).
    for (const choice of ['tourism', 'tourism:', 'real_estate:']) {
      expect(signupSchema.safeParse({ ...validBase, signupChoice: choice }).success).toBe(false)
    }
  })

  it('rejects a deactivated or garbage choice', () => {
    // `event:wedding` ist ungültig: wedding ist ein campaign_type, keine business_type — die
    // aktive event-Option ist `event:`. Ebenso deaktivierte/erfundene Werte.
    for (const choice of ['tourism:bogus', 'event:wedding', 'real_estate:property', 'hackerman']) {
      expect(signupSchema.safeParse({ ...validBase, signupChoice: choice }).success).toBe(false)
    }
  })
})

describe('createEventSchema', () => {
  const validBase = {
    name: 'Hochzeit Schmidt',
    date: '2026-08-15',
    campaignType: 'wedding' as const,
  }

  it('accepts minimal valid event', () => {
    expect(createEventSchema.safeParse(validBase).success).toBe(true)
  })

  it('rejects empty name', () => {
    expect(createEventSchema.safeParse({ ...validBase, name: '' }).success).toBe(false)
  })

  it('rejects invalid date format', () => {
    expect(createEventSchema.safeParse({ ...validBase, date: '15.08.2026' }).success).toBe(false)
    expect(createEventSchema.safeParse({ ...validBase, date: '2026/08/15' }).success).toBe(false)
  })

  it('trims description whitespace', () => {
    const result = createEventSchema.safeParse({ ...validBase, description: '  Beschreibung  ' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.description).toBe('Beschreibung')
  })

  it('requires a campaign type', () => {
    expect(createEventSchema.safeParse({ name: 'Test', date: '2026-08-15' }).success).toBe(false)
  })

  it('rejects an unknown campaign type', () => {
    expect(createEventSchema.safeParse({ ...validBase, campaignType: 'cruise' }).success).toBe(
      false,
    )
  })

  it('accepts an optional flow mode', () => {
    expect(createEventSchema.safeParse({ ...validBase, flowMode: 'feedback' }).success).toBe(true)
    expect(createEventSchema.safeParse({ ...validBase, flowMode: 'invalid' }).success).toBe(false)
  })
})

describe('ratingSchema', () => {
  it('accepts ratings 1–5', () => {
    for (const r of [1, 2, 3, 4, 5]) {
      expect(ratingSchema.safeParse({ rating: r }).success).toBe(true)
    }
  })

  it('rejects 0 and 6', () => {
    expect(ratingSchema.safeParse({ rating: 0 }).success).toBe(false)
    expect(ratingSchema.safeParse({ rating: 6 }).success).toBe(false)
  })

  it('rejects non-integer rating', () => {
    expect(ratingSchema.safeParse({ rating: 3.5 }).success).toBe(false)
  })

  it('rejects string rating', () => {
    expect(ratingSchema.safeParse({ rating: '4' }).success).toBe(false)
  })
})

describe('moderationSchema', () => {
  it('accepts true and false', () => {
    expect(moderationSchema.safeParse({ moderationFlag: true }).success).toBe(true)
    expect(moderationSchema.safeParse({ moderationFlag: false }).success).toBe(true)
  })

  it('rejects string "true"', () => {
    expect(moderationSchema.safeParse({ moderationFlag: 'true' }).success).toBe(false)
  })
})

describe('presignSchema', () => {
  const validBase = {
    eventId: '550e8400-e29b-41d4-a716-446655440000',
    fileName: 'photo.jpg',
    mimeType: 'image/jpeg' as const,
    consent: true as const,
  }

  it('accepts valid upload request', () => {
    expect(presignSchema.safeParse(validBase).success).toBe(true)
  })

  it('rejects a request without consent', () => {
    const withoutConsent = {
      eventId: validBase.eventId,
      fileName: validBase.fileName,
      mimeType: validBase.mimeType,
    }
    expect(presignSchema.safeParse(withoutConsent).success).toBe(false)
    expect(presignSchema.safeParse({ ...validBase, consent: false }).success).toBe(false)
  })

  it('accepts an optional guest name and message (guestbook)', () => {
    const result = presignSchema.safeParse({
      ...validBase,
      guestName: '  Familie Schmidt  ',
      message: '  Alles Gute!  ',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.guestName).toBe('Familie Schmidt')
      expect(result.data.message).toBe('Alles Gute!')
    }
  })

  it('accepts optional structured answers (e.g. wedding three_words as text)', () => {
    expect(
      presignSchema.safeParse({ ...validBase, answers: { three_words: 'schön laut emotional' } })
        .success,
    ).toBe(true)
  })

  it('accepts all allowed MIME types', () => {
    for (const mimeType of ['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime'] as const) {
      expect(presignSchema.safeParse({ ...validBase, mimeType }).success).toBe(true)
    }
  })

  it('rejects unsupported MIME type', () => {
    expect(presignSchema.safeParse({ ...validBase, mimeType: 'image/gif' }).success).toBe(false)
    expect(presignSchema.safeParse({ ...validBase, mimeType: 'application/pdf' }).success).toBe(
      false,
    )
  })

  it('rejects non-UUID event ID', () => {
    expect(presignSchema.safeParse({ ...validBase, eventId: 'not-a-uuid' }).success).toBe(false)
  })

  it('rejects file name with path traversal characters', () => {
    expect(presignSchema.safeParse({ ...validBase, fileName: '../../../etc/passwd' }).success).toBe(
      false,
    )
  })

  it('rejects empty file name', () => {
    expect(presignSchema.safeParse({ ...validBase, fileName: '' }).success).toBe(false)
  })
})

describe('resetPasswordSchema', () => {
  it('accepts matching passwords', () => {
    expect(
      resetPasswordSchema.safeParse({
        password: 'MySecurePass1!',
        confirmPassword: 'MySecurePass1!',
      }).success,
    ).toBe(true)
  })

  it('rejects mismatched passwords', () => {
    expect(
      resetPasswordSchema.safeParse({
        password: 'MySecurePass1!',
        confirmPassword: 'Different1!',
      }).success,
    ).toBe(false)
  })

  it('rejects password shorter than 8 characters', () => {
    expect(
      resetPasswordSchema.safeParse({ password: 'short', confirmPassword: 'short' }).success,
    ).toBe(false)
  })
})

describe('feedbackSchema', () => {
  it('accepts a rating only', () => {
    expect(feedbackSchema.safeParse({ rating: 4 }).success).toBe(true)
  })

  it('accepts a comment only', () => {
    expect(feedbackSchema.safeParse({ comment: 'Sehr schön!' }).success).toBe(true)
  })

  it('accepts a submissionId only (media already uploaded)', () => {
    expect(
      feedbackSchema.safeParse({ submissionId: '550e8400-e29b-41d4-a716-446655440000' }).success,
    ).toBe(true)
  })

  it('rejects an empty submission', () => {
    expect(feedbackSchema.safeParse({}).success).toBe(false)
    expect(feedbackSchema.safeParse({ comment: '   ' }).success).toBe(false)
  })

  it('rejects a comment that is too long', () => {
    expect(feedbackSchema.safeParse({ comment: 'x'.repeat(1001) }).success).toBe(false)
  })

  it('rejects an out-of-range rating', () => {
    expect(feedbackSchema.safeParse({ rating: 6 }).success).toBe(false)
  })

  it('accepts structured answers only (no overall rating/comment)', () => {
    expect(feedbackSchema.safeParse({ answers: { cleanliness: 5, service: 4 } }).success).toBe(true)
  })

  it('accepts a string answer at the form level (value type/key checked downstream)', () => {
    // Zod prüft nur die Form: rating (Zahl 1–5) ODER Text (String). Die Zuordnung Wert-Typ ↔
    // Fragentyp erledigt der Handler (invalidAnswerTypes) + die DB (validate_feedback_answers).
    expect(
      feedbackSchema.safeParse({ answers: { three_words: 'schön laut emotional' } }).success,
    ).toBe(true)
  })

  it('rejects a blank string answer (min length 1 after trim)', () => {
    expect(feedbackSchema.safeParse({ answers: { three_words: '   ' } }).success).toBe(false)
  })

  it('rejects an answer value out of the 1–5 range', () => {
    expect(feedbackSchema.safeParse({ answers: { cleanliness: 0 } }).success).toBe(false)
    expect(feedbackSchema.safeParse({ answers: { cleanliness: 6 } }).success).toBe(false)
    expect(feedbackSchema.safeParse({ answers: { cleanliness: 3.5 } }).success).toBe(false)
  })

  it('rejects an empty submission even with an empty answers object', () => {
    expect(feedbackSchema.safeParse({ answers: {} }).success).toBe(false)
  })
})

describe('guestbookMessageSchema', () => {
  const validBase = { guestName: 'Anna & Ben', message: 'Herzlichen Glückwunsch!', consent: true }

  it('accepts a name + message with consent', () => {
    expect(guestbookMessageSchema.safeParse(validBase).success).toBe(true)
  })

  it('accepts optional structured answers alongside the greeting', () => {
    expect(
      guestbookMessageSchema.safeParse({ ...validBase, answers: { three_words: 'drei worte' } })
        .success,
    ).toBe(true)
  })

  it('trims name and message', () => {
    const result = guestbookMessageSchema.safeParse({
      guestName: '  Anna  ',
      message: '  Alles Liebe  ',
      consent: true,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.guestName).toBe('Anna')
      expect(result.data.message).toBe('Alles Liebe')
    }
  })

  it('rejects a missing or empty name', () => {
    expect(guestbookMessageSchema.safeParse({ message: 'Hi', consent: true }).success).toBe(false)
    expect(
      guestbookMessageSchema.safeParse({ guestName: '   ', message: 'Hi', consent: true }).success,
    ).toBe(false)
  })

  it('rejects an empty message', () => {
    expect(
      guestbookMessageSchema.safeParse({ guestName: 'Anna', message: '   ', consent: true })
        .success,
    ).toBe(false)
  })

  it('rejects without consent', () => {
    expect(
      guestbookMessageSchema.safeParse({ guestName: 'Anna', message: 'Hi', consent: false })
        .success,
    ).toBe(false)
  })
})
