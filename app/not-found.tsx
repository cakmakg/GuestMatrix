import Link from 'next/link'
import type { ReactElement } from 'react'

import { BRAND } from '@/lib/brand'
import { marketingBodyFont, marketingDisplayFont } from '@/lib/fonts'

import { Wordmark } from './(marketing)/_components/Wordmark'

/**
 * 404 — für die GANZE Anwendung, nicht nur für die Startseite.
 *
 * Next rendert diese Datei bei jeder unbekannten Adresse und außerdem überall dort, wo eine Seite
 * `notFound()` aufruft. Das trifft hier zwei sehr verschiedene Menschen:
 *
 * - jemanden, der sich in der Adresse vertippt hat, und
 * - einen GAST, dessen QR-Code auf eine gelöschte oder beendete Kampagne zeigt
 *   (`app/e/[eventId]/page.tsx` ruft `notFound()`, wenn die öffentliche Abfrage nichts liefert).
 *
 * Deshalb wirbt diese Seite nicht („Kostenlos starten" wäre für den Gast die falsche Antwort),
 * sondern sagt beiden, was los ist und was sie tun können.
 *
 * Sie bringt ihr eigenes Gerüst mit: das Marketing-Layout liegt in der Route-Gruppe
 * `(marketing)` und greift bei unbekannten Adressen außerhalb dieser Gruppe nicht. Ohne den
 * Wrapper stünde die Seite im Grundton der Anwendung — also in einer Sprache, die der Besucher
 * an dieser Stelle noch nie gesehen hat.
 */
export default function NotFound(): ReactElement {
  return (
    <div
      className={`gs-mkt ${marketingDisplayFont.variable} ${marketingBodyFont.variable}`}
      data-surface="marketing"
    >
      <div className="gs-mkt-shell">
        <main className="gs-mkt-404">
          <Link href="/" className="gs-mkt-logo" aria-label={BRAND.name}>
            <Wordmark />
          </Link>

          <p className="gs-mkt-kicker">▪ Fehler 404</p>
          <h1>
            Diese Seite gibt es <span className="gs-mkt-em">nicht</span>.
          </h1>

          <p className="gs-mkt-404-text">
            Vielleicht ein Tippfehler in der Adresse — oder die Kampagne dahinter ist beendet. Wenn
            du einen QR-Code gescannt hast, frag kurz beim Veranstalter nach: er kann dir einen
            neuen geben.
          </p>

          <div className="gs-mkt-404-actions">
            <Link href="/" className="gs-mkt-btn" data-tone="dark">
              Zur Startseite
            </Link>
            <Link href="/login" className="gs-mkt-btn" data-tone="outline">
              Anmelden
            </Link>
          </div>
        </main>
      </div>
    </div>
  )
}
