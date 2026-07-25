import 'server-only'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AuthError, AuthorizationError } from '@/lib/auth/errors'

export type TenantSession = {
  userId: string
  tenantId: string
}

export type GuestSession = {
  userId: string
}

/**
 * Requires an authenticated, non-anonymous tenant user.
 * Throws AuthError if the request carries no valid session or no tenant row exists.
 */
export async function requireTenantAuth(): Promise<TenantSession> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user || user.is_anonymous) {
    throw new AuthError()
  }

  // Explicit generic on .single<T>() bypasses supabase-js string-literal type parsing
  // which collapses to `never` under strict tsconfig in supabase-js 2.50+
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('user_id', user.id)
    .single<{ id: string }>()

  if (!tenant) {
    throw new AuthError('Tenant profile not found.')
  }

  return { userId: user.id, tenantId: tenant.id }
}

/**
 * Requires any authenticated user — tenant or anonymous guest.
 * Throws AuthError if no valid session is present.
 */
export async function requireAnyAuth(): Promise<GuestSession> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new AuthError()
  }

  return { userId: user.id }
}

/**
 * Verifies that the given tenant owns the given event.
 * Must be called after requireTenantAuth().
 * Throws AuthorizationError if not the owner — same message as not found to avoid enumeration.
 */
export async function requireEventOwnership(tenantId: string, eventId: string): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('events')
    .select('id')
    .eq('id', eventId)
    .eq('tenant_id', tenantId)
    .single<{ id: string }>()

  if (error || !data) {
    throw new AuthorizationError()
  }
}
