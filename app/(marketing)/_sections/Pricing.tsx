import Link from 'next/link'
import type { ReactElement } from 'react'

import { PRICING_TIERS } from '@/lib/marketing/pricing'

import { MktIcon } from '../_components/icons'

/**
 * „Preise" — die Tarife aus `lib/plans`, mit ihren echten Kontingenten.
 *
 * Kein Eurobetrag: es gibt noch keine Abrechnung. Die Vorlage zeigte eine einzelne
 * „Early Adopter"-Karte mit „Auf Anfrage"; hier stehen beide Tarife, weil die Seite dreimal
 * „Kostenlos starten" sagt — ein Preisabschnitt, der den freien Tarif verschweigt, würde dem
 * Hauptweg widersprechen. Die Zahlen kommen aus der Registry, nicht aus diesem Text.
 */
export function Pricing(): ReactElement {
  return (
    <div className="gs-mkt-shell">
      <section id="preise" className="gs-mkt-section">
        <div className="gs-mkt-section-head">
          <p className="gs-mkt-kicker">▪ Preise</p>
          <h2>
            Preis nach <span className="gs-mkt-em">Anlass</span>.
          </h2>
          <p className="gs-mkt-section-sub">
            Wir sind in der Einführung und passen Momento an die ersten Kundenlagen an. Fang
            kostenlos an — für mehr sprechen wir persönlich.
          </p>
        </div>

        <div className="gs-mkt-tiers">
          {PRICING_TIERS.map((tier) => (
            <article key={tier.plan} className="gs-mkt-tier" data-featured={tier.featured}>
              <p className="gs-mkt-tier-label">{tier.label}</p>
              <p className="gs-mkt-tier-price">{tier.price}</p>
              <p className="gs-mkt-tier-note">{tier.priceNote}</p>

              <ul className="gs-mkt-tier-list">
                {[...tier.quotas, ...tier.extras].map((line) => (
                  <li key={line}>
                    <MktIcon name="check" size={18} bold />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className="gs-mkt-btn"
                data-tone={tier.featured ? 'green' : 'ghost'}
              >
                {tier.ctaLabel}
                <MktIcon name="arrow" size={18} bold />
              </Link>
            </article>
          ))}
        </div>

        {/* In der Einführungsphase schaltet der Betreiber Pro von Hand frei — es gibt weder
            Stripe noch einen Selbstbedienungs-Wechsel. Das gehört auf die Seite, sonst sucht
            jemand einen Kaufknopf, den es nicht gibt. */}
        <p className="gs-mkt-tier-footnote">
          Pro schalten wir in der Einführungsphase persönlich frei — leg einfach ein Konto an.
        </p>
      </section>
    </div>
  )
}
