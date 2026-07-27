import { z } from 'zod'

import { CAMPAIGN_TYPE_TUPLE, FLOW_MODE_TUPLE, SECTOR_TUPLE } from '@/lib/campaigns/config'

// ─── Shared primitives ────────────────────────────────────────────────────────

const uuid = z.string().uuid()

// ─── MIME types (single source of truth for both validation and storage) ──────

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'video/mp4',
  'video/quicktime',
] as const

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number]

export const MIME_TO_EXT: Record<AllowedMimeType, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email('Invalid email address.').max(254).toLowerCase().trim(),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(128),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address.').max(254).toLowerCase().trim(),
})

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters.').max(128),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })

// ─── Events ───────────────────────────────────────────────────────────────────

export const createEventSchema = z.object({
  name: z.string().min(1, 'Name is required.').max(100).trim(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format.'),
  description: z.string().max(500).trim().optional(),
  campaignType: z.enum(CAMPAIGN_TYPE_TUPLE, {
    errorMap: () => ({ message: 'Invalid campaign type.' }),
  }),
  // Only honoured when the campaign type allows a choice (real estate); ignored otherwise.
  flowMode: z.enum(FLOW_MODE_TUPLE).optional(),
})

// ─── Tenant settings ──────────────────────────────────────────────────────────

export const sectorSchema = z.object({
  sector: z.enum(SECTOR_TUPLE, {
    errorMap: () => ({ message: 'Invalid sector.' }),
  }),
})

// ─── Submissions ──────────────────────────────────────────────────────────────

// fileName is sanitised on the server; the field exists only for UX (original name display).
// The actual storage path is always server-generated.
export const presignSchema = z.object({
  eventId: uuid,
  fileName: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-zA-Z0-9._\- ]+$/, 'File name contains invalid characters.'),
  mimeType: z.enum(ALLOWED_MIME_TYPES, {
    errorMap: () => ({ message: 'File type not allowed.' }),
  }),
})

export const moderationSchema = z.object({
  moderationFlag: z.boolean(),
})

export const ratingSchema = z.object({
  rating: z.number({ invalid_type_error: 'Rating must be a number.' }).int().min(1).max(5),
})

// Feedback-Modus (z. B. Hotel-Aufenthalt, Immobilien-Besichtigung): Bewertung und/oder
// Kommentar ohne zwingenden Medien-Upload. Wenn eine submissionId vorliegt, wurde bereits
// ein Medium hochgeladen — dann sind rating/comment optional. Sonst muss mindestens eines
// von rating/comment ausgefüllt sein.
export const feedbackSchema = z
  .object({
    rating: z
      .number({ invalid_type_error: 'Rating must be a number.' })
      .int()
      .min(1)
      .max(5)
      .optional(),
    comment: z.string().max(1000, 'Comment is too long.').trim().optional(),
    submissionId: uuid.optional(),
  })
  .refine((data) => data.rating !== undefined || !!data.comment || !!data.submissionId, {
    message: 'Please provide a rating or a comment.',
    path: ['comment'],
  })

// ─── URL params ───────────────────────────────────────────────────────────────

export const eventIdParam = z.object({ eventId: uuid })
export const submissionIdParam = z.object({ submissionId: uuid })
