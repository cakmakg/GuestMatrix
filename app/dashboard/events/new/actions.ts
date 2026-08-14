'use server'

import { redirect } from 'next/navigation'

import {
  allowedCampaignTypes,
  isBusinessType,
  isSector,
  resolveFlowMode,
  resolveVisibility,
} from '@/lib/sectors'
import { getPlanConfig, resolvePlan } from '@/lib/plans'
import { requireTenantAuth } from '@/lib/auth/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createEventSchema } from '@/lib/validation/schemas'

/**
 * Wohin die Action zurückkehrt. Das Formular steht an zwei Stellen (eigene Seite und leere
 * Übersicht) und soll den Nutzer dort lassen, wo er angefangen hat.
 *
 * Allowlist statt „nimm den Wert aus dem Formular": `returnTo` kommt aus einem versteckten Feld
 * und ist damit Nutzereingabe. Ungeprüft weitergereicht wäre es ein offener Redirect — ein
 * präpariertes Formular könnte den angemeldeten Nutzer nach dem Anlegen auf eine fremde Seite
 * schicken. Unbekannte Werte fallen still auf die eigene Seite zurück.
 */
const RETURN_TO_ALLOWLIST = ['/dashboard', '/dashboard/events/new'] as const
const DEFAULT_RETURN_TO = '/dashboard/events/new'

function resolveReturnTo(value: FormDataEntryValue | null): string {
  const candidate = typeof value === 'string' ? value : ''
  return (RETURN_TO_ALLOWLIST as readonly string[]).includes(candidate)
    ? candidate
    : DEFAULT_RETURN_TO
}

export async function createEventAction(formData: FormData): Promise<void> {
  const { tenantId } = await requireTenantAuth()
  const returnTo = resolveReturnTo(formData.get('returnTo'))

  const parsed = createEventSchema.safeParse({
    name: formData.get('name'),
    date: formData.get('date'),
    venue: formData.get('venue') || undefined,
    description: formData.get('description') || undefined,
    campaignType: formData.get('campaignType'),
    flowMode: formData.get('flowMode') || undefined,
    visibility: formData.get('visibility') || undefined,
  })

  if (!parsed.success) {
    const message = encodeURIComponent(parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.')
    redirect(`${returnTo}?error=${message}`)
  }

  const supabase = await createSupabaseServerClient()

  const { data: tenant } = await supabase
    .from('tenants')
    .select('sector, business_type, plan')
    .eq('id', tenantId)
    .single<{ sector: string; business_type: string | null; plan: string }>()

  const sector = tenant && isSector(tenant.sector) ? tenant.sector : null
  const businessType =
    tenant && tenant.business_type && isBusinessType(tenant.business_type)
      ? tenant.business_type
      : null
  // App-Vorprüfung (freundliche Fehlermeldung); die harte Grenze ist die RLS-WITH-CHECK (0017).
  if (!sector || !allowedCampaignTypes(sector, businessType).includes(parsed.data.campaignType)) {
    redirect(`${returnTo}?error=` + encodeURIComponent('Kampagnentyp passt nicht zur Branche.'))
  }

  // Tarif-Kontingent: aktive (nicht archivierte) Kampagnen begrenzen.
  const planConfig = getPlanConfig(resolvePlan(tenant?.plan))
  const { count: activeEvents } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .is('archived_at', null)

  if ((activeEvents ?? 0) >= planConfig.maxActiveEvents) {
    redirect(
      `${returnTo}?error=` +
        encodeURIComponent(
          `Tarif-Limit erreicht (${planConfig.maxActiveEvents} aktive Kampagne(n)). ` +
            'Bitte archiviere eine Kampagne oder wechsle den Tarif.',
        ),
    )
  }

  const flowMode = resolveFlowMode(parsed.data.campaignType, parsed.data.flowMode ?? null)
  const visibility = resolveVisibility(parsed.data.campaignType, parsed.data.visibility ?? null)

  const { data, error } = await supabase
    .from('events')
    .insert({
      tenant_id: tenantId,
      name: parsed.data.name,
      date: parsed.data.date,
      venue: parsed.data.venue ?? null,
      description: parsed.data.description ?? null,
      campaign_type: parsed.data.campaignType,
      flow_mode: flowMode,
      visibility,
    })
    .select('id')
    .single<{ id: string }>()

  if (error || !data) {
    redirect(`${returnTo}?error=Fehler+beim+Erstellen+der+Kampagne.`)
  }

  // Von der leeren Übersicht aus zurück auf die Übersicht: dort steht jetzt die echte Kampagne
  // an der Stelle, an der eben noch das Formular stand. Von der eigenen Seite aus bleibt es beim
  // Sprung ins Kampagnendetail, wo die nächsten Schritte (QR, Einstellungen) liegen.
  redirect(returnTo === '/dashboard' ? '/dashboard' : `/dashboard/events/${data.id}?created=1`)
}
