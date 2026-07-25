import type { NextRequest } from 'next/server'

import { handleRouteError } from '@/lib/auth/errors'
import { checkRateLimit, rateLimiters } from '@/lib/rate-limit'
import { createSupabaseServerClient } from '@/lib/supabase/server'

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'
  )
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const ip = getClientIp(request)
    await checkRateLimit(rateLimiters.anonSession, ip)

    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.auth.signInAnonymously()

    if (error || !data.user) {
      return Response.json({ error: 'Session creation failed.' }, { status: 500 })
    }

    return Response.json({ userId: data.user.id }, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
