import 'server-only'

import { ALLOWED_MIME_TYPES, type AllowedMimeType } from '@/lib/validation/schemas'

/**
 * Reads the first 12 bytes of a file via a signed URL and returns its MIME type
 * based on magic bytes. Returns null if the type cannot be determined or is not
 * in our allow-list.
 *
 * No external dependency — we only need to detect the four types we accept.
 */
async function detectMimeFromMagicBytes(signedUrl: string): Promise<string | null> {
  let response: Response
  try {
    response = await fetch(signedUrl, { headers: { Range: 'bytes=0-11' } })
  } catch {
    return null
  }

  if (!response.ok) return null

  const buf = new Uint8Array(await response.arrayBuffer())

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png'

  // MP4 / QuickTime: ISO Base Media File (ftyp box at offset 4–7)
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
    const brand = String.fromCharCode(buf[8] ?? 0, buf[9] ?? 0, buf[10] ?? 0, buf[11] ?? 0)
    // QuickTime brand
    if (brand === 'qt  ') return 'video/quicktime'
    // Common MP4 brands: isom, mp41, mp42, avc1, M4V, dash, etc.
    return 'video/mp4'
  }

  return null
}

function isAllowedMime(mime: string): mime is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mime)
}

export type MimeValidationResult =
  { valid: true; detectedMime: AllowedMimeType } | { valid: false; detectedMime: string | null }

/**
 * Downloads the first 12 bytes of the file at signedUrl and validates the magic bytes.
 * Returns valid: true only when the detected type is in our allow-list.
 */
export async function validateFileMime(signedUrl: string): Promise<MimeValidationResult> {
  const detected = await detectMimeFromMagicBytes(signedUrl)

  if (detected && isAllowedMime(detected)) {
    return { valid: true, detectedMime: detected }
  }

  return { valid: false, detectedMime: detected }
}
