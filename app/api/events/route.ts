import type { NextRequest } from 'next/server'

import { isSector, isValidCampaignForSector, resolveFlowMode } from '@/lib/campaigns/config'
import { handleRouteError, ValidationError } from '@/lib/auth/errors'
import { requireTenantAuth } from '@/lib/auth/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createEventSchema } from '@/lib/validation/schemas'

type EventListRow = {
  id: string
  name: string
  date: string
  description: string | null
  campaign_type: string
  flow_mode: string
  archived_at: string | null
  created_at: string
}

export async function GET(): Promise<Response> {
  try {
    const { tenantId } = await requireTenantAuth()
    const supabase = await createSupabaseServerClient()

    const { data, error } = await supabase
      .from('events')
      .select('id, name, date, description, campaign_type, flow_mode, archived_at, created_at')
      .eq('tenant_id', tenantId)
      .order('date', { ascending: false })

    if (error) {
      return Response.json({ error: 'Something went wrong.' }, { status: 500 })
    }

    return Response.json({ events: (data as EventListRow[]) ?? [] })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { tenantId } = await requireTenantAuth()

    const body: unknown = await request.json().catch(() => null)
    const parsed = createEventSchema.safeParse(body)
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid request.')
    }

    const supabase = await createSupabaseServerClient()

    const { data: tenant } = await supabase
      .from('tenants')
      .select('sector')
      .eq('id', tenantId)
      .single<{ sector: string }>()

    const sector = tenant && isSector(tenant.sector) ? tenant.sector : null
    if (!sector || !isValidCampaignForSector(sector, parsed.data.campaignType)) {
      throw new ValidationError('Campaign type does not match sector.')
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
      .select('id, name, date, campaign_type, flow_mode')
      .single<{
        id: string
        name: string
        date: string
        campaign_type: string
        flow_mode: string
      }>()

    if (error || !data) {
      return Response.json({ error: 'Something went wrong.' }, { status: 500 })
    }

    return Response.json({ event: data }, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
