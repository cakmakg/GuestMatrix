import Link from 'next/link'
import { redirect } from 'next/navigation'

import { requireTenantAuth } from '@/lib/auth/session'
import { moreNavItems } from '@/lib/dashboard/nav'
import { resolveDashboardCapabilities, resolveDashboardLabels } from '@/lib/sectors'
import { createSupabaseServerClient } from '@/lib/supabase/server'

import { NAV_ICONS } from '../nav-icons'

type TenantRow = { sector: string; business_type: string | null }

const MUTED = 'color-mix(in srgb, var(--color-text) 55%, transparent)'

/**
 * „Mehr" — die Ziele, die nicht in die vier Plätze der unteren Leiste passen.
 *
 * Existiert allein für das Telefon: auf dem Desktop stehen dieselben Einträge in der
 * Seitenleiste, und die Seite ist dort nur über einen direkten Link erreichbar. Sie führt
 * NICHTS Eigenes — was sie zeigt, kommt aus `moreNavItems`, damit ein neu hinzugefügtes
 * Navigationsziel hier automatisch auftaucht statt vergessen zu werden.
 */
export default async function MorePage() {
  try {
    await requireTenantAuth()
  } catch {
    redirect('/login')
  }

  const supabase = await createSupabaseServerClient()
  const { data: tenant } = await supabase
    .from('tenants')
    .select('sector, business_type')
    .single<TenantRow>()

  const labels = resolveDashboardLabels(tenant?.sector, tenant?.business_type)
  const can = resolveDashboardCapabilities(tenant?.sector, tenant?.business_type)
  const items = moreNavItems(labels, can)

  return (
    <div className="gs-page">
      <div className="gs-page-head gs-rise" data-i="0">
        <div>
          <div className="gs-kicker">Navigation</div>
          <h1>Mehr</h1>
          <div className="gs-page-lead">Alles, was nicht in die untere Leiste passt.</div>
        </div>
      </div>

      <section className="gs-panel gs-rise" data-i="1" style={{ gap: 0, padding: '4px 0' }}>
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="gs-nav-item"
            style={{ minHeight: 52, padding: '14px 18px' }}
          >
            <span className="gs-icn">{NAV_ICONS[item.id]}</span>
            <span className="gs-nav-label">{item.label}</span>
            <span className="gs-icn" style={{ marginLeft: 'auto', width: 14, height: 14 }}>
              <svg viewBox="0 0 24 24">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </Link>
        ))}
      </section>

      <form action="/api/auth/logout" method="POST">
        <button type="submit" className="btn btn-secondary" style={{ minHeight: 44 }}>
          Abmelden
        </button>
      </form>

      <div style={{ fontSize: 12, color: MUTED }}>
        QR-basierte Gäste-Feedback- und UGC-Plattform
      </div>
    </div>
  )
}
