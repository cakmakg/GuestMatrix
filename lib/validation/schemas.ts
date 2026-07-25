import { z } from 'zod'

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

// ─── URL params ───────────────────────────────────────────────────────────────

export const eventIdParam = z.object({ eventId: uuid })
export const submissionIdParam = z.object({ submissionId: uuid })
