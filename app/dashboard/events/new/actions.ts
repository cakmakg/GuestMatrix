'use server'

import { redirect } from 'next/navigation'

import { allowedCampaignTypes, isBusinessType, isSector, resolveFlowMode } from '@/lib/sectors'
import { getPlanConfig, resolvePlan } from '@/lib/plans'
import { requireTenantAuth } from '@/lib/auth/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createEventSchema } from '@/lib/validation/schemas'

export async function createEventAction(formData: FormData): Promise<void> {
  const { tenantId } = await requireTenantAuth()

  const parsed = createEventSchema.safeParse({
    name: formData.get('name'),
    date: formData.get('date'),
    description: formData.get('description') || undefined,
    campaignType: formData.get('campaignType'),
    flowMode: formData.get('flowMode') || undefined,
  })

  if (!parsed.success) {
    const message = encodeURIComponent(parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.')
    redirect(`/dashboard/events/new?error=${message}`)
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
    redirect(
      '/dashboard/events/new?error=' + encodeURIComponent('Kampagnentyp passt nicht zur Branche.'),
    )
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
      '/dashboard/events/new?error=' +
        encodeURIComponent(
          `Tarif-Limit erreicht (${planConfig.maxActiveEvents} aktive Kampagne(n)). ` +
            'Bitte archiviere eine Kampagne oder wechsle den Tarif.',
        ),
    )
  }

  const flowMode = resolveFlowMode(parsed.data.campaignType, parsed.data.flowMode ?? null)

  const { data, error } = await supabase
    .from('events')
    .insert({
      tenant_id: tenantId,
      name: parsed.data.name,
      date: parsed.data.date,
      description: parsed.data.description ?? null,
      campaign_type: parsed.data.campaignType,
      flow_mode: flowMode,
    })
    .select('id')
    .single<{ id: string }>()

  if (error || !data) {
    redirect('/dashboard/events/new?error=Fehler+beim+Erstellen+der+Kampagne.')
  }

  redirect(`/dashboard/events/${data.id}?created=1`)
}
