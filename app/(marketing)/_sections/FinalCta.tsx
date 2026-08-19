import Link from 'next/link'
import type { ReactElement } from 'react'

import { MktIcon } from '../_components/icons'

/**
 * Das farbige Schlussbanner — der letzte Weg in die Registrierung.
 *
 * Die Vorlage stellt hier „Kostenlos starten" neben „Demo ansehen". Eine Demo gibt es nicht,
 * und ein Knopf, der auf nichts zeigt, kostet an dieser Stelle mehr Vertrauen als er einbringt.
 * Der zweite Weg führt deshalb zur Anmeldung — für die, die schon Kunde sind.
 */
export function FinalCta(): ReactElement {
  return (
    <section className="gs-mkt-cta">
      <div className="gs-mkt-shell">
        <div className="gs-mkt-cta-inner">
          <div>
            <p className="gs-mkt-kicker">▪ Bereit?</p>
            <h2>
              Jetzt kostenlos <span className="gs-mkt-em">starten</span>.
            </h2>
            <p className="gs-mkt-cta-sub">
              In zehn Minuten dein erster QR-Code — dein erstes Feedback ist wahrscheinlich
              schneller da.
            </p>
          </div>

          <div className="gs-mkt-cta-actions">
            <Link href="/signup" className="gs-mkt-btn" data-tone="on-color" data-size="lg">
              Kostenlos starten
              <MktIcon name="arrow" size={20} bold />
            </Link>
            <Link href="/login" className="gs-mkt-btn" data-tone="on-color-ghost" data-size="lg">
              Anmelden
              <MktIcon name="arrow" size={20} bold />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
