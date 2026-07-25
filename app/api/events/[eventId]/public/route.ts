import type { NextRequest } from 'next/server'

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
      .select('id, name, description, tenant_id')
      .eq('id', eventId)
      .single<{ id: string; name: string; description: string | null; tenant_id: string }>()

    if (error || !event) throw new NotFoundError('Event')

    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('brand_name')
      .eq('id', event.tenant_id)
      .single<{ brand_name: string }>()

    return Response.json({
      id: event.id,
      name: event.name,
      description: event.description,
      brandName: tenant?.brand_name ?? null,
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
