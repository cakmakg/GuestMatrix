import { redirect } from 'next/navigation'

import { requireTenantAuth } from '@/lib/auth/session'
import { BRAND } from '@/lib/brand'
import { quotaPercent } from '@/lib/dashboard/metrics'
import { getPlanConfig, resolvePlan } from '@/lib/plans'
import { resolveDashboardCapabilities, resolveDashboardLabels } from '@/lib/sectors'
import { createSupabaseServerClient } from '@/lib/supabase/server'

import { BottomNav } from './BottomNav'
import { SidebarNav } from './SidebarNav'

type TenantRow = {
  brand_name: string
  plan: string
  sector: string
  business_type: string | null
}

const MUTED = 'color-mix(in srgb, var(--color-text) 55%, transparent)'

function initialsOf(value: string): string {
  const local = value.split('@')[0] ?? value
  const parts = local.split(/[._-]+/).filter(Boolean)
  const [first, second] = parts
  if (first && second) return `${first.charAt(0)}${second.charAt(0)}`.toUpperCase()
  return local.slice(0, 2).toUpperCase() || '?'
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireTenantAuth()
  } catch {
    // Authentifiziert, aber ohne Tenant (verwaister Auth-Nutzer) → NICHT direkt auf /login:
    // die Middleware würde einen eingeloggten Nutzer sofort wieder auf /dashboard schicken
    // (endlose /dashboard ↔ /login-307-Schleife). Stattdessen die Session über den
    // Logout-Endpunkt löschen; danach ist /login wirklich erreichbar.
    redirect('/api/auth/logout?next=/login')
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // RLS liefert nur den eigenen Tenant; kein .eq('user_id') nötig, es bleibt aber
  // als Defense-in-Depth in den übrigen Abfragen bestehen.
  const { data: tenant } = await supabase
    .from('tenants')
    .select('brand_name, plan, sector, business_type')
    .single<TenantRow>()

  const { count: activeCount } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .is('archived_at', null)

  const { count: campaignCount } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })

  const plan = resolvePlan(tenant?.plan)
  const planConfig = getPlanConfig(plan)
  const activeEvents = activeCount ?? 0
  const planPct = quotaPercent(activeEvents, planConfig.maxActiveEvents)

  // Wie dieser Tenant seine Arbeitseinheit nennt — aus der Registry, nicht aus einer Fallunterscheidung.
  const labels = resolveDashboardLabels(tenant?.sector, tenant?.business_type)
  // Ebenso der Umfang der Navigation: „Berichte" existiert nur, wo es etwas auszuwerten gibt.
  const can = resolveDashboardCapabilities(tenant?.sector, tenant?.business_type)

  const email = user?.email ?? ''
  const brandName = tenant?.brand_name ?? BRAND.name

  return (
    <div className="gs-shell">
      {/* ═══ SIDEBAR (ab 1024px; darunter übernimmt BottomNav) ═══ */}
      <aside className="gs-sidebar">
        <div
          style={{
            padding: '4px 24px 22px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span
            style={{
              width: 22,
              height: 22,
              background: 'var(--color-accent)',
              display: 'inline-block',
            }}
          />
          <span
            style={{
              font: '800 18px/1 var(--font-heading)',
              letterSpacing: '-0.01em',
            }}
          >
            {BRAND.name}
          </span>
        </div>

        <SidebarNav labels={labels} can={can} experiencesCount={campaignCount ?? 0} />

        <div
          style={{
            marginTop: 'auto',
            padding: '20px 24px',
            borderTop: '2px solid var(--color-divider)',
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: '.1em',
              textTransform: 'uppercase',
              color: MUTED,
              marginBottom: 8,
            }}
          >
            Tarif
          </div>
          <div style={{ font: '800 15px/1.2 var(--font-heading)', marginBottom: 4 }}>
            {planConfig.label}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'color-mix(in srgb, var(--color-text) 60%, transparent)',
            }}
          >
            {activeEvents} von {planConfig.maxActiveEvents} aktiven{' '}
            {labels.experiences.toLowerCase()}
          </div>
          <div className="gs-bar" style={{ marginTop: 10 }}>
            <i style={{ width: `${planPct}%` }} />
          </div>
        </div>
      </aside>

      {/* ═══ MAIN ═══ */}
      <div className="gs-main">
        <header className="gs-topbar">
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 12,
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                font: '800 18px/1.15 var(--font-heading)',
                letterSpacing: '-0.01em',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
              }}
            >
              {brandName}
            </div>
          </div>

          <div
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              paddingLeft: 14,
              borderLeft: '1px solid var(--color-divider)',
            }}
          >
            <div
              className="gs-avatar"
              style={{
                width: 32,
                height: 32,
                background: 'var(--color-accent)',
                color: 'var(--color-bg)',
                border: 0,
              }}
            >
              {initialsOf(email)}
            </div>
            <div
              style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15, minWidth: 0 }}
            >
              <span
                className="gs-topbar-email"
                style={{
                  font: '600 13px/1.15 var(--font-body)',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  maxWidth: 200,
                }}
              >
                {email}
              </span>
              <form action="/api/auth/logout" method="POST">
                <button
                  type="submit"
                  style={{
                    background: 'none',
                    border: 0,
                    padding: 0,
                    font: '11px/1.2 var(--font-body)',
                    color: MUTED,
                    cursor: 'pointer',
                  }}
                >
                  Abmelden
                </button>
              </form>
            </div>
          </div>
        </header>

        <main style={{ minWidth: 0 }}>{children}</main>
      </div>

      {/* Nur unter 1024px sichtbar; ersetzt dort die ausgeblendete Seitenleiste. */}
      <BottomNav labels={labels} />
    </div>
  )
}
