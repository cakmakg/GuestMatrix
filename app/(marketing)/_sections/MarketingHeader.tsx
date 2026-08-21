import Link from 'next/link'
import type { ReactElement } from 'react'

import { BRAND } from '@/lib/brand'

import { MktIcon } from '../_components/icons'
import { Wordmark } from '../_components/Wordmark'

/**
 * Kopfleiste der Marketing-Fläche: Wortmarke, drei Sprungmarken, zwei Wege.
 *
 * Sie klebt beim Scrollen oben (`position: sticky`) — der Hauptweg soll auf einer 4000 Pixel
 * langen Seite nie weiter als einen Blick entfernt sein.
 *
 * Es stehen nur Sprungmarken hier, deren Abschnitt es auch gibt: ein Menüpunkt auf einen Anker
 * ohne Ziel springt nicht, er tut gar nichts — und das sieht für den Besucher aus wie eine
 * kaputte Seite. Die Anker heißen seit dem neuen Entwurf `#warum`, `#pakete` und `#ablauf`; wer
 * einen davon umbenennt, muss den Fuß (`MarketingFooter`) mit umbenennen.
 *
 * Unter 900px verschwinden die drei Sprungmarken, unter 480px zusätzlich „Anmelden" — dann
 * bleibt allein der Hauptweg stehen (Regeln in globals.css). Eine zweite Zeile wäre die
 * Alternative; sie schöbe aber bei jedem Besuch den Hero nach unten, für ein Menü, das auf dem
 * Telefon ohnehin kaum jemand benutzt.
 *
 * Aus der Vorlage NICHT übernommen: der runde Knopf für den Farbmodus. Die Marketing-Fläche hat
 * keine zweite Erscheinung — sie bringt einen eigenen Tokensatz mit und keine Themen-Achse
 * (siehe den Kopf des Marketing-Blocks in globals.css). Ein Schalter, der nichts schaltet, ist
 * schlimmer als kein Schalter.
 */
const NAV_LINKS: readonly { label: string; href: string }[] = [
  { label: 'Über', href: '#warum' },
  { label: 'Pakete', href: '#pakete' },
  { label: 'Ablauf', href: '#ablauf' },
]

export function MarketingHeader(): ReactElement {
  return (
    <header className="gs-mkt-header">
      <div className="gs-mkt-shell">
        <nav className="gs-mkt-nav">
          <Link href="/" className="gs-mkt-logo" aria-label={BRAND.name}>
            <Wordmark />
          </Link>

          <div className="gs-mkt-nav-links">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="gs-mkt-nav-link">
                {link.label}
              </a>
            ))}
          </div>

          <div className="gs-mkt-nav-actions">
            <Link href="/login" className="gs-mkt-nav-link">
              Anmelden
            </Link>
            <Link href="/signup" className="gs-mkt-btn" data-tone="dark" data-size="sm">
              Jetzt starten
              <MktIcon name="arrow" size={14} bold />
            </Link>
          </div>
        </nav>
      </div>
    </header>
  )
}
