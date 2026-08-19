import Link from 'next/link'
import type { ReactElement } from 'react'

import { BRAND } from '@/lib/brand'

/**
 * Kopfleiste der Marketing-Fläche: Farbstreifen, Wortmarke, Sprungmarken, zwei Wege.
 *
 * Es stehen nur Sprungmarken hier, deren Abschnitt es auch gibt: ein Menüpunkt auf einen Anker
 * ohne Ziel springt nicht, er tut gar nichts — und das sieht für den Besucher aus wie eine
 * kaputte Seite. Mit den vier Abschnitten aus Dilim C sind das jetzt vier.
 *
 * Die Leiste bricht NICHT um: vier Sprungmarken, „Anmelden" und der Hauptknopf passen nur auf
 * breiten Bildschirmen nebeneinander. Deshalb tragen die Punkte eine Rangordnung, und globals.css
 * blendet sie von unten nach oben aus (`data-rank`) — unter 480px bleibt allein der Hauptweg
 * stehen. Eine zweite Zeile wäre die Alternative; sie schöbe aber bei jedem Besuch den Hero nach
 * unten, für ein Menü, das auf dem Telefon ohnehin niemand benutzt.
 */
const NAV_LINKS: readonly { label: string; href: string; rank: number }[] = [
  { label: 'Lösung', href: '#loesung', rank: 3 },
  { label: 'So funktioniert’s', href: '#funktion', rank: 3 },
  { label: 'Anlässe', href: '#anlaesse', rank: 2 },
  { label: 'Preise', href: '#preise', rank: 2 },
]

export function MarketingHeader(): ReactElement {
  return (
    <header>
      {/* Rein dekorativ, deshalb ohne Text und ohne Rolle. Die Farben stehen in globals.css. */}
      <div className="gs-mkt-stripes" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>

      <div className="gs-mkt-shell">
        <nav className="gs-mkt-nav">
          <Link href="/" className="gs-mkt-logo">
            {BRAND.name}
            <span>.</span>
          </Link>

          <div className="gs-mkt-nav-actions">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="gs-mkt-nav-link" data-rank={link.rank}>
                {link.label}
              </a>
            ))}

            <Link href="/login" className="gs-mkt-nav-link" data-rank={2}>
              Anmelden
            </Link>
            <Link href="/signup" className="gs-mkt-btn" data-tone="ink">
              Kostenlos starten
            </Link>
          </div>
        </nav>
      </div>
    </header>
  )
}
