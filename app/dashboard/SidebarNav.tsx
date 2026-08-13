'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { dashboardNavItems } from '@/lib/dashboard/nav'
import type { DashboardCapabilities, DashboardLabels } from '@/lib/sectors'

import { NAV_ICONS } from './nav-icons'

/**
 * Seitenleiste (Desktop). Die Ziele kommen aus `dashboardNavItems` — derselben Quelle, aus der
 * sich auch die untere Leiste des Telefons speist; die Liste steht deshalb nur einmal im Code.
 *
 * Beschriftungen und Umfang leiten sich aus der Registry ab: ein Hotel liest „Aufenthalte", eine
 * Agentur „Reisen", ein Brautpaar „Feiern" — dieselbe Route, kein Sonderfall-Code. Wer keine
 * Auswertung hat (Gästebuch), bekommt „Berichte" gar nicht erst angeboten.
 */

type Props = {
  labels: DashboardLabels
  can: DashboardCapabilities
  experiencesCount: number
}

export function SidebarNav({ labels, can, experiencesCount }: Props): React.ReactElement {
  const pathname = usePathname()
  const items = dashboardNavItems(labels, can)

  return (
    <nav style={{ display: 'flex', flexDirection: 'column', padding: '4px 0' }}>
      {items.map((item) => {
        // Exakter Treffer: /dashboard darf nicht bei jeder Unterseite aktiv wirken.
        const isCurrent = pathname === item.href
        const badge = item.id === 'experiences' ? experiencesCount : 0

        return (
          <Link
            key={item.id}
            href={item.href}
            className="gs-nav-item"
            aria-current={isCurrent ? 'page' : undefined}
          >
            <span className="gs-icn">{NAV_ICONS[item.id]}</span>
            <span className="gs-nav-label">{item.label}</span>
            {badge > 0 && (
              <span
                className="tag tag-neutral"
                style={{ marginLeft: 'auto', fontSize: 10, padding: '2px 7px' }}
              >
                {badge}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
