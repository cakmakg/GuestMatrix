import 'server-only'

import { NotFoundError, StorageDeletionError } from '@/lib/auth/errors'
import { logger } from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const BUCKET = 'ugc-media'

/**
 * GDPR-Löschung einer Einreichung (Gast oder Tenant) — fail-safe, ein gemeinsamer Pfad.
 *
 * Ownership wird in der DB erzwungen: die SECURITY-DEFINER-RPCs prüfen
 * `guest_user_id = auth.uid() OR tenant_id = current_tenant_id()`. Der Aufrufer-Kontext ergibt
 * sich aus dem JWT des Server-Clients (Gast-Anon oder Tenant), daher braucht es keine
 * Fallunterscheidung hier.
 *
 * Reihenfolge (fail-safe): Datei ZUERST aus dem Storage entfernen und den Fehler prüfen; erst
 * danach `deleted_at` setzen. So wird `deleted_at` nie gesetzt, solange die Datei nicht
 * nachweislich weg ist — keine stille Diskrepanz zwischen DB und Bucket.
 */
export async function deleteSubmission(submissionId: string): Promise<void> {
  const supabase = await createSupabaseServerClient()

  // 1) Ownership-geprüft die media_url lesen — bewusst über die RPC statt einer normalen Query,
  //    da public_gallery_select die SELECT-Sichtbarkeit über den Eigentümer hinaus verbreitert.
  const { data: owned, error: readError } = await supabase.rpc('owned_submission_media', {
    p_submission_id: submissionId,
  })
  if (readError) throw readError
  const ownedRow = owned?.[0]
  if (!ownedRow) throw new NotFoundError('Submission')
  const mediaUrl = ownedRow.media_url

  // 2) Fail-safe: Storage hart löschen und Fehler prüfen. Schlägt es fehl, bleibt deleted_at
  //    ungesetzt (konsistenter, wiederholbarer Zustand). Eine bereits fehlende Datei meldet
  //    Supabase nicht als Fehler → Ziel (Datei weg) ist erreicht.
  if (mediaUrl) {
    const { error: storageError } = await supabaseAdmin.storage.from(BUCKET).remove([mediaUrl])
    if (storageError) {
      logger.error('[gdpr_delete] storage_remove_failed', {
        submissionId,
        message: storageError.message,
      })
      throw new StorageDeletionError()
    }
  }

  // 3) Erst jetzt den Soft-Delete committen (Ownership erneut in der DB geprüft). Die
  //    zurückgegebene id wird nicht gebraucht: kein Treffer = zwischenzeitlich schon gelöscht
  //    (Race), und die Datei ist ohnehin entfernt — der Zielzustand ist erreicht.
  const { error: deleteError } = await supabase.rpc('soft_delete_submission', {
    p_submission_id: submissionId,
  })
  if (deleteError) throw deleteError
}
