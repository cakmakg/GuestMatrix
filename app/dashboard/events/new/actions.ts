'use server'

import { redirect } from 'next/navigation'

import { isSector, isValidCampaignForSector, resolveFlowMode } from '@/lib/campaigns/config'
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
    .select('sector')
    .eq('id', tenantId)
    .single<{ sector: string }>()

  const sector = tenant && isSector(tenant.sector) ? tenant.sector : null
  if (!sector || !isValidCampaignForSector(sector, parsed.data.campaignType)) {
    redirect(
      '/dashboard/events/new?error=' + encodeURIComponent('Kampagnentyp passt nicht zur Branche.'),
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
