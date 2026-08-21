import Link from 'next/link'
import type { ReactElement } from 'react'

import { MARKETING_SEGMENTS } from '@/lib/marketing/segments'

import { GuestPhone } from '../_components/GuestPhone'
import { MktIcon } from '../_components/icons'

/**
 * Erster Bildschirm: das Versprechen links, der Gäste-Ablauf als Telefon rechts.
 *
 * Die drei Kennzahlen unter den Knöpfen sind Angaben, die JEDER Besucher nachprüfen kann. In der
 * Vorlage stand in der Mitte „Gehostet — Berlin, DE"; die Region der Supabase-Instanz ist nicht
 * bestätigt, und eine Aussage über den Speicherort ist im Zweifel ein Rechtsversprechen und kein
 * Werbetext. An ihrer Stelle steht, was der Gast erlebt.
 *
 * Ebenfalls nicht übernommen: „Demo ansehen" als zweiter Knopf. Eine Demo gibt es nicht, und ein
 * Knopf, der auf nichts zeigt, kostet an dieser Stelle mehr Vertrauen als er einbringt. Der
 * zweite Weg führt deshalb zur Anmeldung — für die, die schon Kunde sind.
 *
 * Die Aufzählung im Abzeichen kommt aus der Registry: sie nennt genau die Geschäftsarten, die
 * die Registrierung auch anbietet. Wird eine abgeschaltet, verschwindet sie hier mit.
 */
type Fact = { label: string; value: string }

const FACTS: readonly Fact[] = [
  { label: 'In der Beta', value: '2026' },
  { label: 'Für Gäste', value: 'Ohne App' },
  { label: 'Einrichtung', value: '< 10 Min' },
]

export function Hero(): ReactElement {
  const segments = MARKETING_SEGMENTS
  // Die Attrappe zeigt eine echte Geschäftsart aus der Registry, nicht ein erfundenes Beispiel.
  // Die erste ist die, die auch in der Registrierung oben steht.
  const lead = segments[0]

  return (
    <div className="gs-mkt-shell" data-width="wide">
      <section className="gs-mkt-hero">
        <div>
          <p className="gs-mkt-note gs-mkt-hero-eyebrow">
            Von Momento — gebaut für Gastgeber, nicht für Marketing-Abteilungen.
          </p>

          <p className="gs-mkt-badge">
            <i />
            <span>
              Jetzt in der Beta
              {segments.length > 0 &&
                ` — ${segments.map((segment) => segment.navLabel).join(' · ')}`}
            </span>
          </p>

          <h1 className="gs-mkt-hero-title">
            <span>Teile deine</span>
            <span className="gs-mkt-em">Erfahrungen.</span>
          </h1>

          <p className="gs-mkt-hero-sub">
            Sammle Fotos, Videos und Feedback direkt von deinen Gästen — mit einem einzigen QR-Code.
            Ohne App, ohne Anmeldung.
          </p>

          <div className="gs-mkt-hero-actions">
            <Link href="/signup" className="gs-mkt-btn" data-tone="dark">
              Kostenlos starten
              <MktIcon name="arrow" size={14} bold />
            </Link>
            <Link href="/login" className="gs-mkt-btn" data-tone="outline">
              Anmelden
            </Link>
          </div>

          <hr className="gs-mkt-rule gs-mkt-hero-rule" />

          <dl className="gs-mkt-hero-facts">
            {FACTS.map((fact) => (
              <div key={fact.label}>
                <dt className="gs-mkt-fact-label">{fact.label}</dt>
                <dd className="gs-mkt-fact-value">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="gs-mkt-hero-stage gs-mkt-stage-glow">
          {lead !== undefined && <GuestPhone card={lead.card} />}

          <span className="gs-mkt-callout" data-place="bottom-left" aria-hidden="true">
            Ohne App
          </span>
          <span
            className="gs-mkt-callout"
            data-place="top-right"
            data-tone="ink"
            aria-hidden="true"
          >
            DSGVO
          </span>
        </div>
      </section>
    </div>
  )
}
