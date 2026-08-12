'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Nur Routen, die es wirklich gibt. Der Entwurf zeigt zusätzlich „Berichte"-Nachbarn wie
 * „Team" — die sind hier bewusst weggelassen, statt tote Links auszuliefern.
 *
 * Die Beschriftung der Experiences-Route ist NICHT fest verdrahtet: sie kommt als Prop aus
 * dem Layout, das sie über `resolveDashboardLabels` aus der Sektor-Registry auflöst. Ein Hotel
 * liest „Aufenthalte", eine Agentur „Reisen" — dieselbe Route, kein Sonderfall-Code.
 */

const ICONS = {
  overview: (
    <svg viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="9" />
      <rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="12" width="7" height="9" />
      <rect x="3" y="16" width="7" height="5" />
    </svg>
  ),
  experiences: (
    <svg viewBox="0 0 24 24">
      <path d="M3 11l18-5v12L3 13v-2z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  ),
  feedback: (
    <svg viewBox="0 0 24 24">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  media: (
    <svg viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" />
      <circle cx="9" cy="9" r="2" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  ),
  reports: (
    <svg viewBox="0 0 24 24">
      <path d="M3 3v18h18" />
      <path d="M7 15l4-4 3 3 5-7" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
} as const

type Props = {
  /** Aus `resolveDashboardLabels` — „Aufenthalte" / „Reisen" / „Feiern". */
  experiencesLabel: string
  experiencesCount: number
}

export function SidebarNav({ experiencesLabel, experiencesCount }: Props): React.ReactElement {
  const pathname = usePathname()

  const items = [
    { href: '/dashboard', label: 'Übersicht', icon: ICONS.overview },
    {
      href: '/dashboard/experiences',
      label: experiencesLabel,
      icon: ICONS.experiences,
      count: experiencesCount,
    },
    { href: '/dashboard/feedback', label: 'Gästeantworten', icon: ICONS.feedback },
    { href: '/dashboard/media', label: 'Medien', icon: ICONS.media },
    { href: '/dashboard/reports', label: 'Berichte', icon: ICONS.reports },
    { href: '/dashboard/settings', label: 'Einstellungen', icon: ICONS.settings },
  ]

  return (
    <nav style={{ display: 'flex', flexDirection: 'column', padding: '4px 0' }}>
      {items.map((item) => {
        // Exakter Treffer: /dashboard darf nicht bei jeder Unterseite aktiv wirken.
        const isCurrent = pathname === item.href

        return (
          <Link
            key={item.href}
            href={item.href}
            className="gs-nav-item"
            aria-current={isCurrent ? 'page' : undefined}
          >
            <span className="gs-icn">{item.icon}</span>
            <span className="gs-nav-label">{item.label}</span>
            {item.count !== undefined && item.count > 0 && (
              <span
                className="tag tag-neutral"
                style={{ marginLeft: 'auto', fontSize: 10, padding: '2px 7px' }}
              >
                {item.count}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
