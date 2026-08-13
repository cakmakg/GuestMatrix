'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { NotFoundError } from '@/lib/auth/errors'
import { requireEventOwnership, requireTenantAuth } from '@/lib/auth/session'
import { logger } from '@/lib/logger'
import { deleteSubmission } from '@/lib/submissions/delete-submission'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { updateEventSchema } from '@/lib/validation/schemas'

/**
 * Gemeinsame Dashboard-Mutationen. Sie liegen hier statt in einem Routen-Ordner, weil
 * mehrere Seiten sie auslösen (Übersicht, Kampagnendetail, Medien-Bibliothek).
 *
 * Alle drei revalidieren `/dashboard` als LAYOUT: ein Moderations-Flag oder eine Löschung
 * verändert nicht nur die auslösende Seite, sondern auch die Kennzahlen der Übersicht, die
 * Zählungen im Bericht, die Abzeichen in der Antwortliste und die Medien-Bibliothek. Nur den
 * Ursprungspfad zu revalidieren hinterließe die übrigen Seiten mit veralteten Zahlen.
 */

export async function setEventArchivedAction(eventId: string, archived: boolean): Promise<void> {
  const { tenantId } = await requireTenantAuth()
  await requireEventOwnership(tenantId, eventId)

  const supabase = await createSupabaseServerClient()
  await supabase
    .from('events')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', eventId)
    .eq('tenant_id', tenantId)

  revalidatePath('/dashboard', 'layout')
}

/**
 * Stammdaten einer Kampagne ändern: Name, Datum, Ort, Begrüßung.
 *
 * NICHT änderbar sind Kampagnentyp, Ablauf und Sichtbarkeit — sie bestimmen, was der Gast sieht
 * und worin er eingewilligt hat. Für `visibility` erzwingt das zusätzlich die DB
 * (`tenant_update_own_events` WITH CHECK, 0021); das Schema lässt das Feld gar nicht erst zu.
 *
 * `description` ist der Text, den der Gast beim Scannen liest — die Änderung wirkt deshalb auch
 * auf den öffentlichen Gäste-Pfad, der ihn zwischenspeichert.
 */
export async function updateEventAction(eventId: string, formData: FormData): Promise<void> {
  const { tenantId } = await requireTenantAuth()
  await requireEventOwnership(tenantId, eventId)

  const parsed = updateEventSchema.safeParse({
    name: formData.get('name') ?? '',
    date: formData.get('date') ?? '',
    venue: formData.get('venue') ?? '',
    description: formData.get('description') ?? '',
  })

  if (!parsed.success) {
    const message = encodeURIComponent(parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.')
    redirect(`/dashboard/events/${eventId}?error=${message}`)
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from('events')
    .update({
      name: parsed.data.name,
      date: parsed.data.date,
      // Leeres Feld heißt „kein Ort/keine Begrüßung" — als NULL, nicht als leerer String, damit
      // die Anzeige nur eine Prüfung braucht.
      venue: parsed.data.venue === '' ? null : parsed.data.venue,
      description: parsed.data.description === '' ? null : parsed.data.description,
    })
    .eq('id', eventId)
    .eq('tenant_id', tenantId)

  if (error) {
    logger.error('updateEventAction failed', { eventId, error: error.message })
    redirect(`/dashboard/events/${eventId}?error=Speichern+fehlgeschlagen.`)
  }

  revalidatePath('/dashboard', 'layout')
  // Der Gäste-Pfad zeigt Name und Begrüßung; ohne diese Zeile liefe er bis zu 60s alt weiter.
  revalidatePath(`/e/${eventId}`)
  redirect(`/dashboard/events/${eventId}?saved=1`)
}

export async function moderateAction(submissionId: string, flag: boolean): Promise<void> {
  const { tenantId } = await requireTenantAuth()

  // Moderation läuft RLS-aktiv: Sichtbarkeit + Berechtigung erzwingen tenant_select_submissions
  // (Lesen) und tenant_update_submissions (Flag-Update) über tenant_id = current_tenant_id().
  // Kein service_role für die Flag-Mutation; die .eq('tenant_id')-Filter bleiben als Defense-in-Depth.
  const supabase = await createSupabaseServerClient()

  const { data: sub } = await supabase
    .from('submissions')
    .select('id, event_id, tenant_id')
    .eq('id', submissionId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .single<{ id: string; event_id: string; tenant_id: string }>()

  if (!sub) throw new NotFoundError('Submission')

  const { error } = await supabase
    .from('submissions')
    .update({ moderation_flag: flag })
    .eq('id', submissionId)
    .eq('tenant_id', tenantId)

  if (error) throw error

  logger.info('[dashboard] moderation_flag set', { submissionId, flag, tenantId })
  revalidatePath('/dashboard', 'layout')
}

/**
 * Service Recovery: einen Beitrag als bearbeitet markieren (oder wieder öffnen).
 *
 * `resolved_at` ist ein interner Betreiber-Vermerk — er ändert weder die Sichtbarkeit für Gäste
 * noch den Moderationsstatus. Beides bleibt bewusst getrennt: „gesperrt" heißt, das Medium darf
 * nicht in die Galerie; „erledigt" heißt, der Betreiber hat auf die Rückmeldung reagiert.
 */
export async function resolveAction(submissionId: string, resolved: boolean): Promise<void> {
  const { tenantId } = await requireTenantAuth()

  // Wie moderateAction: RLS-aktiv (tenant_select_submissions / tenant_update_submissions,
  // beide über tenant_id = current_tenant_id()); die .eq('tenant_id')-Filter sind Defense-in-Depth.
  const supabase = await createSupabaseServerClient()

  const { data: sub } = await supabase
    .from('submissions')
    .select('id')
    .eq('id', submissionId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .single<{ id: string }>()

  if (!sub) throw new NotFoundError('Submission')

  const { error } = await supabase
    .from('submissions')
    .update({ resolved_at: resolved ? new Date().toISOString() : null })
    .eq('id', submissionId)
    .eq('tenant_id', tenantId)

  if (error) throw error

  logger.info('[dashboard] resolution set', { submissionId, resolved, tenantId })
  revalidatePath('/dashboard', 'layout')
}

export async function deleteFromDashboardAction(submissionId: string): Promise<void> {
  await requireTenantAuth()

  // Ownership-scoped über den Server-Client (tenant_select RLS): nicht sichtbar = nicht dem
  // eigenen Tenant → NotFoundError, noch vor der Löschung.
  const supabase = await createSupabaseServerClient()
  const { data: sub } = await supabase
    .from('submissions')
    .select('event_id')
    .eq('id', submissionId)
    .is('deleted_at', null)
    .single<{ event_id: string }>()

  if (!sub) throw new NotFoundError('Submission')

  // Fail-safe GDPR-Löschung (Storage hard-delete + Soft-Delete, Ownership in der DB).
  await deleteSubmission(submissionId)

  logger.info('[dashboard] submission deleted by tenant', { submissionId })
  revalidatePath('/dashboard', 'layout')
}
