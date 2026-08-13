'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { bottomNavItems } from '@/lib/dashboard/nav'
import type { DashboardLabels } from '@/lib/sectors'

import { NAV_ICONS } from './nav-icons'

/**
 * Navigation am unteren Rand — nur auf Telefon/Tablet sichtbar (`.gs-bottom-nav`, ausgeblendet
 * ab 1024px). Gegenstück zur Seitenleiste, gespeist aus derselben Zielquelle.
 *
 * Anders als dort gilt hier ein PRÄFIX-Treffer für die Aktiv-Markierung: wer aus der Antwortliste
 * in eine Detailseite abbiegt, soll den Daumen nicht auf einer scheinbar leeren Leiste wiederfinden.
 * „Übersicht" ist davon ausgenommen, sonst wäre sie überall aktiv.
 */

type Props = {
  labels: DashboardLabels
}

export function BottomNav({ labels }: Props): React.ReactElement {
  const pathname = usePathname()
  const items = bottomNavItems(labels)

  return (
    <nav className="gs-bottom-nav" aria-label="Hauptnavigation">
      <ul>
        {items.map((item) => {
          const isCurrent =
            item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href)

          return (
            <li key={item.id}>
              <Link href={item.href} aria-current={isCurrent ? 'page' : undefined}>
                <span className="gs-icn">{NAV_ICONS[item.id]}</span>
                <span>{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
