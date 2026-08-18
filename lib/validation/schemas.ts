import { z } from 'zod'

import {
  CAMPAIGN_TYPE_TUPLE,
  EVENT_VISIBILITY_TUPLE,
  FLOW_MODE_TUPLE,
  isSignupChoice,
} from '@/lib/sectors'

// ─── Shared primitives ────────────────────────────────────────────────────────

const uuid = z.string().uuid()

// Gastname für den Gästebuch-Gruß (Event/Hochzeit). Auf DB-Ebene optional; im
// guestbook-Modus erzwingt die Validierung unten einen Namen.
// trim() vor min(1), damit reine Leerzeichen als leer gelten.
const guestName = z.string().trim().min(1, 'Name is required.').max(80)

// Server-seitiges Consent-Gate: nur `true` ist gültig. Fehlt/ist false → kein
// Submission-Datensatz, keine Upload-URL. (Gästemedien = personenbezogene Daten.)
const consent = z.literal(true, {
  errorMap: () => ({ message: 'Consent is required.' }),
})

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

// Self-Service-Registrierung. Der Kunde wählt EINE Geschäftsart aus der aktiven Registry
// (SIGNUP_OPTIONS); `signupChoice` kodiert (sector, business_type) als `${sector}:${businessType}`.
// isSignupChoice akzeptiert nur, was das Formular auch anbietet (nur aktive Kombinationen). Die
// Server-Action übersetzt die Wahl serverseitig in sector + business_type (Autorität = Registry,
// nicht der Client) und schickt beides via signUp options.data in raw_user_meta_data. Der Trigger
// handle_new_user (0017) validiert Allowlist + DB-CHECK unabhängig (Defense-in-Depth, falls diese
// Ebene per direktem auth.signUp umgangen wird).
export const signupSchema = z.object({
  email: z.string().email('Invalid email address.').max(254).toLowerCase().trim(),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(128),
  brandName: z.string().trim().min(1, 'Name is required.').max(100),
  signupChoice: z.string().refine(isSignupChoice, { message: 'Invalid selection.' }),
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
  // trim() VOR min(1) — sonst zählt „   " als drei Zeichen und eine Kampagne ohne Namen kommt
  // durch (dieselbe Reihenfolge wie beim guestName oben).
  name: z.string().trim().min(1, 'Name is required.').max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format.'),
  // Optionaler Ort (0022) — Hochzeit: Location, Agentur: Reiseziel, Hotel: Haus.
  venue: z.string().max(120).trim().optional(),
  description: z.string().max(500).trim().optional(),
  campaignType: z.enum(CAMPAIGN_TYPE_TUPLE, {
    errorMap: () => ({ message: 'Invalid campaign type.' }),
  }),
  // Only honoured when the campaign type allows a choice (real estate); ignored otherwise.
  flowMode: z.enum(FLOW_MODE_TUPLE).optional(),
  // Only honoured when the campaign type allows a choice (wedding, 0021); ignored otherwise.
  visibility: z.enum(EVENT_VISIBILITY_TUPLE).optional(),
})

/**
 * Nachträgliches Bearbeiten einer Kampagne.
 *
 * Bewusst OHNE `campaignType`, `flowMode` und `visibility`: die drei bestimmen, was der Gast sieht
 * und wozu er eingewilligt hat. `visibility` ist zusätzlich DB-seitig festgenagelt (0021,
 * `tenant_update_own_events` WITH CHECK) — täte diese Route es doch, würde Postgres den UPDATE
 * ablehnen. Das Schema bildet diese Grenze ab, statt sie erst an der DB scheitern zu lassen.
 *
 * Leerer String ist gültig und bedeutet „Feld leeren" (→ NULL); deshalb hier kein `.min(1)` auf
 * den optionalen Feldern.
 */
export const updateEventSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format.'),
  venue: z.string().max(120).trim(),
  description: z.string().max(500).trim(),
})

// ─── Submissions ──────────────────────────────────────────────────────────────

// Strukturierte Zusatzantworten, generisch als { fragenId: Wert } gespeichert. Zwei Werttypen:
// rating (Zahl 1–5) und text (String). Das Zod-Schema prüft NUR die FORM (beide Typen erlaubt); die
// Zuordnung Wert-Typ ↔ Fragentyp macht der Handler (invalidAnswerTypes) und — als letzte
// Verteidigungslinie — die DB (validate_feedback_answers, Migration 0019), da jsonb schemalos ist.
export const feedbackAnswersSchema = z.record(
  z.string(),
  z.union([
    z.number({ invalid_type_error: 'Answer must be a number.' }).int().min(1).max(5),
    z.string().trim().min(1).max(280),
  ]),
)

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
  consent,
  // Nur im guestbook-Modus mitgesendet: Name + Glückwunsch am Medienbeitrag.
  guestName: guestName.optional(),
  message: z.string().max(1000, 'Message is too long.').trim().optional(),
  // Optionale strukturierte Antworten (z. B. Hochzeit „drei Worte") am Medienbeitrag.
  answers: feedbackAnswersSchema.optional(),
})

// Gästebuch-Modus (Event/Hochzeit) ohne Medien: reiner Glückwunsch mit Name.
// Für Beiträge mit Medien wird stattdessen presignSchema (guestName + message) genutzt.
export const guestbookMessageSchema = z.object({
  guestName,
  message: z.string().trim().min(1, 'Message is required.').max(1000),
  consent,
  // Optionale strukturierte Antworten (z. B. Hochzeit „drei Worte") am medienlosen Gruß.
  answers: feedbackAnswersSchema.optional(),
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
// von rating/comment/answers ausgefüllt sein.
export const feedbackSchema = z
  .object({
    rating: z
      .number({ invalid_type_error: 'Rating must be a number.' })
      .int()
      .min(1)
      .max(5)
      .optional(),
    comment: z.string().max(1000, 'Comment is too long.').trim().optional(),
    answers: feedbackAnswersSchema.optional(),
    submissionId: uuid.optional(),
    // Freiwillig (gallery/feedback). Ein Name ALLEIN ist bewusst keine gültige Rückmeldung —
    // dafür sorgt das `refine` unten, das weiterhin Note, Kommentar, Antworten oder eine
    // Einreichung verlangt.
    guestName: guestName.optional(),
  })
  .refine(
    (data) =>
      data.rating !== undefined ||
      !!data.comment ||
      !!data.submissionId ||
      (data.answers !== undefined && Object.keys(data.answers).length > 0),
    {
      message: 'Please provide a rating or a comment.',
      path: ['comment'],
    },
  )

// ─── URL params ───────────────────────────────────────────────────────────────

export const eventIdParam = z.object({ eventId: uuid })
export const submissionIdParam = z.object({ submissionId: uuid })
