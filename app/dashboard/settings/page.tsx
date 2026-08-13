import Link from 'next/link'
import { redirect } from 'next/navigation'

import {
  SECTORS,
  allowedCampaignTypes,
  getBusinessTypeConfig,
  getCampaignConfig,
  isBusinessType,
  isSector,
} from '@/lib/sectors'
import { getPlanConfig, resolvePlan } from '@/lib/plans'
import { requireTenantAuth } from '@/lib/auth/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const MUTED = 'color-mix(in srgb, var(--color-text) 55%, transparent)'

export default async function SettingsPage() {
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
    .select('sector, business_type, plan')
    .eq('id', tenantId)
    .single<{ sector: string; business_type: string | null; plan: string }>()

  const sector = tenant && isSector(tenant.sector) ? tenant.sector : null
  const businessType =
    tenant && tenant.business_type && isBusinessType(tenant.business_type)
      ? tenant.business_type
      : null
  const plan = resolvePlan(tenant?.plan)
  const planConfig = getPlanConfig(plan)

  return (
    <div className="gs-page" style={{ maxWidth: 640 }}>
      <div className="gs-page-head gs-rise" data-i="0">
        <div>
          <Link href="/dashboard" style={{ fontSize: 13, color: MUTED }}>
            ← Übersicht
          </Link>
          <div className="gs-kicker" style={{ marginTop: 10 }}>
            Konto
          </div>
          <h1>Einstellungen</h1>
        </div>
      </div>

      {/* ═══ Geschäftsart ═══ */}
      <section className="gs-panel gs-rise" data-i="1">
        <div>
          <h3 style={{ fontSize: 20, margin: '0 0 4px' }}>Geschäftsart</h3>
          <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>
            Wird bei der Registrierung festgelegt und bestimmt, welche Kampagnentypen du anlegen
            kannst. Danach unveränderlich — zum Ändern wende dich bitte an den Support.
          </p>
        </div>

        {sector ? (
          <>
            <div style={{ font: '800 20px/1.2 var(--font-heading)' }}>
              {businessType
                ? (getBusinessTypeConfig(businessType)?.label ?? SECTORS[sector]?.label)
                : SECTORS[sector]?.label}
            </div>
            <div>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: '.1em',
                  textTransform: 'uppercase',
                  color: MUTED,
                  marginBottom: 8,
                }}
              >
                Verfügbare Kampagnentypen
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {allowedCampaignTypes(sector, businessType).map((type) => (
                  <span key={type} className="tag tag-neutral">
                    {getCampaignConfig(type)?.label}
                  </span>
                ))}
              </div>
            </div>
          </>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--color-accent)', margin: 0 }}>
            Keine Geschäftsart zugewiesen. Bitte kontaktiere den Support.
          </p>
        )}
      </section>

      {/* ═══ Tarif ═══ */}
      <section className="gs-panel gs-rise" data-i="2">
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h3 style={{ fontSize: 20, margin: '0 0 4px' }}>Tarif</h3>
            <div style={{ font: '800 20px/1.2 var(--font-heading)', marginBottom: 8 }}>
              {planConfig.label}
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: MUTED }}>
              <li>Bis zu {planConfig.maxActiveEvents} aktive Kampagne(n)</li>
              <li>Bis zu {planConfig.maxUploadsPerEvent} Uploads je Kampagne</li>
            </ul>
          </div>
          <button type="button" disabled className="btn btn-secondary" title="Bald verfügbar">
            Upgrade (bald)
          </button>
        </div>
      </section>
    </div>
  )
}
