import type { ReactElement } from 'react'

import { MARKETING_SEGMENTS } from '@/lib/marketing/segments'

import { MktIcon } from '../_components/icons'

/**
 * „Anlässe" — je aktive Geschäftsart eine Karte, in der Reihenfolge der Registrierung.
 *
 * Dieselbe Quelle wie der Hero-Wechsler (`MARKETING_SEGMENTS`). Wird ein Sektor aktiviert,
 * erscheint hier eine Karte, ohne dass jemand diese Datei anfassen muss; wird einer abgeschaltet,
 * verschwindet die Werbung dafür.
 *
 * Die Überschrift nennt die Zahl NICHT („Drei Welten" stand in der Vorlage): sie stimmt heute
 * zufällig und wäre beim nächsten Sektor falsch.
 */
export function UseCases(): ReactElement {
  return (
    <div className="gs-mkt-shell">
      <section id="anlaesse" className="gs-mkt-section">
        <div className="gs-mkt-section-head">
          <p className="gs-mkt-kicker">▪ Für jeden Anlass</p>
          <h2>
            Eine Plattform. <span className="gs-mkt-em">Jeder Anlass.</span>
          </h2>
          <p className="gs-mkt-section-sub">Dasselbe QR-Prinzip — angepasst an deinen Kontext.</p>
        </div>

        <div className="gs-mkt-usecases">
          {MARKETING_SEGMENTS.map((segment) => (
            <article
              key={segment.option.value}
              className="gs-mkt-usecase"
              data-accent={segment.card.accent}
            >
              <div className="gs-mkt-usecase-head">
                <div className="gs-mkt-usecase-icon">
                  <MktIcon name={segment.card.icon} size={28} />
                </div>
                <div>
                  <h3>{segment.useCase.title}</h3>
                  <p className="gs-mkt-usecase-tagline">{segment.useCase.tagline}</p>
                </div>
              </div>

              <p className="gs-mkt-usecase-body">{segment.useCase.body}</p>

              <ul className="gs-mkt-usecase-list">
                {segment.useCase.bullets.map((bullet) => (
                  <li key={bullet.label}>
                    <MktIcon name="check" size={14} bold />
                    <span>{bullet.label}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
