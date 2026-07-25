import { describe, expect, it } from 'vitest'

import {
  createEventSchema,
  loginSchema,
  moderationSchema,
  presignSchema,
  ratingSchema,
  resetPasswordSchema,
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

describe('createEventSchema', () => {
  it('accepts minimal valid event', () => {
    expect(
      createEventSchema.safeParse({ name: 'Hochzeit Schmidt', date: '2026-08-15' }).success,
    ).toBe(true)
  })

  it('rejects empty name', () => {
    expect(createEventSchema.safeParse({ name: '', date: '2026-08-15' }).success).toBe(false)
  })

  it('rejects invalid date format', () => {
    expect(createEventSchema.safeParse({ name: 'Test', date: '15.08.2026' }).success).toBe(false)
    expect(createEventSchema.safeParse({ name: 'Test', date: '2026/08/15' }).success).toBe(false)
  })

  it('trims description whitespace', () => {
    const result = createEventSchema.safeParse({
      name: 'Test Event',
      date: '2026-08-15',
      description: '  Beschreibung  ',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.description).toBe('Beschreibung')
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
  }

  it('accepts valid upload request', () => {
    expect(presignSchema.safeParse(validBase).success).toBe(true)
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
