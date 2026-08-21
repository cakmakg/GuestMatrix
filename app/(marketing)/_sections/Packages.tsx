import Link from 'next/link'
import type { ReactElement } from 'react'

import { PRICING_TIERS } from '@/lib/marketing/pricing'
import { MARKETING_SEGMENTS } from '@/lib/marketing/segments'

/**
 * „Pakete" — je aktive Geschäftsart eine Kachel, darunter die Tarife. Nachfolger von `UseCases`
 * und `Pricing`, die der neue Entwurf zu einem Abschnitt zusammenlegt.
 *
 * Die Kacheln kommen aus derselben Registry wie Hero und Laufband (`MARKETING_SEGMENTS`). Wird
 * ein Sektor aktiviert, erscheint hier eine Kachel, ohne dass jemand diese Datei anfassen muss;
 * wird einer abgeschaltet, verschwindet die Werbung dafür. Welche Kachel dunkel heraussticht,
 * sagt ebenfalls die Registry (`card.accent === 'ink'`).
 *
 * ── Die Preise ────────────────────────────────────────────────────────────
 * Die Vorlage schreibt „Ab €49 / Monat", „Ab €39 / Reise", „Ab €99 / Event" in die Kacheln.
 * Nichts davon kann heute jemand bezahlen: es gibt keine Abrechnung (kein Stripe,
 * `docs/vision.md` Punkt 2), und die Tarife heißen `free` und `pro`, nicht Hotel/Reise/Event.
 * Ein Betrag ohne Kasse dahinter ist beim ersten Kundengespräch eine Hypothek — und
 * `tests/marketing.test.ts` hält genau das fest.
 *
 * Deshalb steht in der Preiszeile der Kachel die Kurzform der Geschäftsart, und die echte
 * Staffel steht EINMAL darunter: der Tarif hängt am Konto, nicht an der Geschäftsart, und
 * dieselbe Staffel gilt für alle drei Kacheln. Die Zahlen kommen aus `lib/plans`.
 *
 * Ebenfalls nicht übernommen: „Details ansehen" als Knopf. Es gibt keine Detailseiten je
 * Geschäftsart, und drei Knöpfe ins Leere sind an der Stelle, an der jemand kaufen will, der
 * teuerste Fehler der Seite. Alle drei führen in die Registrierung.
 *
 * Und keine „Premium"-Marke auf der dunklen Kachel: dunkel ist hier Rangfolge, kein Tarif.
 */
export function Packages(): ReactElement {
  return (
    <section id="pakete" className="gs-mkt-section" data-tone="paper">
      <div className="gs-mkt-shell">
        <div className="gs-mkt-section-head" data-align="center">
          <p className="gs-mkt-kicker">Wähl deine Welt</p>
          <h2 className="gs-mkt-section-title">
            QR-Erlebnisse für Hotels, Reisen und Feiern — für{' '}
            <span className="gs-mkt-em">unvergessliche Momente</span>, die geteilt werden.
          </h2>
        </div>

        <div className="gs-mkt-packages">
          {MARKETING_SEGMENTS.map((segment) => (
            <article
              key={segment.option.value}
              className="gs-mkt-package"
              data-accent={segment.card.accent}
            >
              <h3 className="gs-mkt-package-title">{segment.useCase.title}</h3>
              <p className="gs-mkt-package-price">{segment.useCase.tagline}</p>
              <p className="gs-mkt-package-body">{segment.useCase.body}</p>

              <ul className="gs-mkt-package-list">
                {segment.useCase.bullets.map((bullet) => (
                  <li key={bullet.label}>{bullet.label}</li>
                ))}
              </ul>

              <Link
                href="/signup"
                className="gs-mkt-btn"
                data-tone={segment.card.accent === 'ink' ? 'gold' : 'ghost'}
              >
                Kostenlos starten
              </Link>
            </article>
          ))}
        </div>

        <div className="gs-mkt-tariffs">
          {PRICING_TIERS.map((tier) => (
            <div key={tier.plan} className="gs-mkt-tariff">
              <div className="gs-mkt-tariff-head">
                <span className="gs-mkt-tariff-label">{tier.label}</span>
                <span className="gs-mkt-tariff-price" data-featured={tier.featured}>
                  {tier.price}
                </span>
              </div>
              <ul className="gs-mkt-tariff-lines">
                {[...tier.quotas, ...tier.extras].map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* In der Einführungsphase schaltet der Betreiber Pro von Hand frei — es gibt weder
            Stripe noch einen Selbstbedienungs-Wechsel. Das gehört auf die Seite, sonst sucht
            jemand einen Kaufknopf, den es nicht gibt. */}
        <p className="gs-mkt-tariff-note">
          Beide Tarife starten gleich: Konto anlegen, QR-Code erstellen. Pro schalten wir in der
          Einführungsphase persönlich frei.
        </p>
      </div>
    </section>
  )
}
