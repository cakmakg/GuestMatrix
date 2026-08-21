import Link from 'next/link'
import type { ReactElement } from 'react'

import { MktIcon } from '../_components/icons'

/**
 * Das dunkle Schlussbanner — der letzte Weg in die Registrierung.
 *
 * Die Vorlage stellt hier „Kostenlos starten" neben „Demo vereinbaren". Eine Demo gibt es nicht,
 * und es gibt auch keine Kontaktadresse im Produkt, unter der man einen Termin vereinbaren
 * könnte. Ein Knopf, der auf nichts zeigt, kostet an dieser Stelle mehr Vertrauen als er
 * einbringt. Der zweite Weg führt deshalb zur Anmeldung — für die, die schon Kunde sind.
 *
 * Die Bildfläche links ist bewusst leer und zeigt ihr Farbfeld: siehe die Begründung in
 * `_components/ImageBand.tsx`. Sie ist der Ort, an dem später ein echtes Foto steht.
 */
export function FinalCta(): ReactElement {
  return (
    <section className="gs-mkt-cta">
      <div className="gs-mkt-shell">
        <div className="gs-mkt-cta-card">
          {/* Die Bildfläche ist bewusst leer und zeigt ihr Farbfeld — dieselbe Begründung wie
              bei den Bildbändern (`_components/ImageBand.tsx`): ein Symbolfoto fremder Menschen
              wäre auf einer Seite, deren Versprechen Einwilligung heißt, das falsche Bild. Hier
              steht später eine echte Aufnahme aus einer Kundenkampagne. */}
          <div className="gs-mkt-cta-visual" aria-hidden="true" />

          <div className="gs-mkt-cta-copy">
            <p className="gs-mkt-kicker">▪ Bereit anzufangen?</p>

            <h2 className="gs-mkt-cta-title">
              <span>Mach deinen Anlass</span>
              <span className="gs-mkt-em">unvergesslich.</span>
            </h2>

            <p className="gs-mkt-cta-sub">
              In zehn Minuten dein erster QR-Code — dein erstes Feedback ist wahrscheinlich
              schneller da.
            </p>

            <div className="gs-mkt-cta-actions">
              <Link href="/signup" className="gs-mkt-btn" data-tone="on-dark">
                Kostenlos starten
                <MktIcon name="arrow" size={14} bold />
              </Link>
              <Link href="/login" className="gs-mkt-btn" data-tone="on-dark-ghost">
                Anmelden
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
