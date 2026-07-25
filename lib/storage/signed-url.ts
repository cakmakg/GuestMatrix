import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/admin'

const BUCKET = 'ugc-media'

/** Ablaufzeiten für signierte URLs — zentraler Ort für alle Policies */
export const SIGNED_URL_EXPIRY = {
  /** 1 Stunde — Galerie-Anzeige und Einzeldownload */
  gallery: 3600,
  /** 5 Minuten — Vorschau nach Upload-Bestätigung */
  preview: 300,
  /** 1 Minute — nur für den MIME-Magic-Byte-Read benötigt */
  mimeCheck: 60,
} as const

/**
 * Erstellt eine signierte URL für eine einzelne Datei.
 * Gibt null zurück, wenn die Datei nicht gefunden wurde oder ein Fehler auftrat.
 */
export async function createSignedUrl(path: string, expiresIn: number): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, expiresIn)
  if (error || !data) return null
  return data.signedUrl
}

/**
 * Erstellt signierte URLs für mehrere Dateien in einem einzigen API-Aufruf.
 * Gibt eine Map<Pfad, signierteUrl> zurück.
 */
export async function createSignedUrls(
  paths: string[],
  expiresIn: number,
): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map()

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrls(paths, expiresIn)

  if (error || !data) return new Map()
  const map = new Map<string, string>()
  for (const item of data) {
    if (item.path !== null && item.signedUrl !== null) {
      map.set(item.path, item.signedUrl)
    }
  }
  return map
}
