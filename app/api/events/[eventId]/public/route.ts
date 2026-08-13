import type { NextRequest } from 'next/server'

import {
  getCapabilities,
  isCampaignType,
  isEventVisibility,
  isFlowMode,
  resolveLabels,
} from '@/lib/sectors'
import { handleRouteError, NotFoundError, ValidationError } from '@/lib/auth/errors'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { eventIdParam } from '@/lib/validation/schemas'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
): Promise<Response> {
  try {
    const rawParams = await params
    const parsed = eventIdParam.safeParse(rawParams)
    if (!parsed.success) throw new ValidationError('Invalid event ID.')

    const { eventId } = parsed.data

    const { data: event, error } = await supabaseAdmin
      .from('events')
      .select('id, name, description, campaign_type, flow_mode, visibility, archived_at, tenant_id')
      .eq('id', eventId)
      .single<{
        id: string
        name: string
        description: string | null
        campaign_type: string
        flow_mode: string
        visibility: string
        archived_at: string | null
        tenant_id: string
      }>()

    if (error || !event) throw new NotFoundError('Event')

    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('brand_name')
      .eq('id', event.tenant_id)
      .single<{ brand_name: string }>()

    // Fallback auf 'agency'/'gallery', falls Bestandsdaten den Wert nicht kennen (agency ist der
    // aktive gallery-Beachhead seit dem Remodel 0016).
    const campaignType = isCampaignType(event.campaign_type) ? event.campaign_type : 'agency'
    const flowMode = isFlowMode(event.flow_mode) ? event.flow_mode : 'gallery'
    const visibility = isEventVisibility(event.visibility) ? event.visibility : 'private'

    return Response.json({
      id: event.id,
      name: event.name,
      description: event.description,
      brandName: tenant?.brand_name ?? null,
      campaignType,
      flowMode,
      capabilities: getCapabilities(flowMode),
      labels: resolveLabels(campaignType, flowMode, visibility),
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
