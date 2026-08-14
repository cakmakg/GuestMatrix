import Link from 'next/link'
import { redirect } from 'next/navigation'

import { SECTORS, isSector } from '@/lib/sectors'
import { requireTenantAuth } from '@/lib/auth/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'

import { EventForm } from './EventForm'

const MUTED = 'color-mix(in srgb, var(--color-text) 55%, transparent)'

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  let tenantId: string
  try {
    const session = await requireTenantAuth()
    tenantId = session.tenantId
  } catch {
    redirect('/login')
  }

  const supabase = await createSupabaseServerClient()
  const { data: tenant } = await supabase
    .from('tenants')
    .select('sector, business_type')
    .eq('id', tenantId)
    .single<{ sector: string; business_type: string | null }>()

  const sector = tenant && isSector(tenant.sector) ? tenant.sector : null

  // Branche wird vom Betreiber zugewiesen (kein Self-Service). Fehlt sie, zeigt die
  // Einstellungsseite den Hinweis zum Support-Kontakt.
  if (!sector) {
    redirect('/dashboard/settings')
  }

  return (
    <div className="gs-page" style={{ maxWidth: 640 }}>
      <div className="gs-page-head gs-rise" data-i="0">
        <div>
          <Link href="/dashboard" style={{ fontSize: 13, color: MUTED }}>
            ← Zurück
          </Link>
          <div className="gs-kicker" style={{ marginTop: 10 }}>
            {SECTORS[sector]?.label}
          </div>
          <h1>Neue Kampagne</h1>
        </div>
      </div>

      {error && (
        <div
          className="gs-panel gs-rise"
          data-i="1"
          style={{ borderColor: 'var(--color-accent)', padding: '14px 16px' }}
        >
          {decodeURIComponent(error)}
        </div>
      )}

      <EventForm
        sector={sector}
        businessType={tenant?.business_type ?? null}
        returnTo="/dashboard/events/new"
        submitLabel="Kampagne erstellen"
      />
    </div>
  )
}
