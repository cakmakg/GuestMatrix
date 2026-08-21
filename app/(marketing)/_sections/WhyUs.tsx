import type { ReactElement } from 'react'

import { MARKETING_SEGMENTS } from '@/lib/marketing/segments'

import { DashboardFloats, DashboardPhone } from '../_components/DashboardPhone'
import { MktIcon } from '../_components/icons'

/**
 * „Warum Momento" — der Abschnitt zwischen Versprechen und Ablauf. Nachfolger von `Problem`.
 *
 * Der Hero zeigt, was der GAST tut; hier steht, was der BETRIEB davon sieht. Deshalb liegt die
 * zweite Telefon-Attrappe hier und nicht weiter unten: wer bis hierhin gelesen hat, glaubt das
 * Versprechen und will wissen, wo die Beiträge landen.
 *
 * Die vier Zeilen der Liste sind alle im Repository nachweisbar — dieselbe Regel wie im
 * Datenschutz-Abschnitt. Zwei Korrekturen gegenüber der Design-Vorlage, beide aus demselben
 * Grund (die Vorlage bewirbt eine größere Software, als es sie gibt):
 *
 * - „DSGVO-konform, aus Deutschland" — der Speicherort der Supabase-Instanz ist unbestätigt.
 *   Was stimmt, ist die Bauweise: Einwilligung, Moderation und Löschpfad gehören zum Ablauf.
 * - „Ein zentrales Dashboard für dein ganzes Team" (so an anderer Stelle der Vorlage) — ein
 *   Tenant ist heute genau EIN Auth-Nutzer (`docs/vision.md`, Punkt C2). Es gibt keine zweite
 *   Anmeldung, die man einladen könnte.
 *
 * Zur Anrede: die Vorlage wechselt ab hier auf „Sie". Die Seite bleibt bei „du" — so sprechen
 * das Dashboard und der Gäste-Flow, und ein Wechsel mitten auf der Startseite liest sich wie
 * zwei verschiedene Absender.
 */
const CHECKLIST: readonly string[] = [
  'Alles an einem Ort.',
  'Ohne App, ohne Anmeldung.',
  'Einwilligung, Moderation, Löschpfad.',
  'Ein Dashboard für alle Kampagnen.',
]

export function WhyUs(): ReactElement {
  const lead = MARKETING_SEGMENTS[0]

  return (
    <section id="warum" className="gs-mkt-section">
      <div className="gs-mkt-shell">
        <div className="gs-mkt-chapter">
          <div className="gs-mkt-chapter-row">
            <p className="gs-mkt-kicker">▪ Warum Betriebe uns wählen</p>
            <p className="gs-mkt-note">Kap. 01 — Die Plattform</p>
          </div>
          <hr className="gs-mkt-rule" />
        </div>

        <div className="gs-mkt-why">
          <div className="gs-mkt-why-stage gs-mkt-stage-glow">
            {lead !== undefined && <DashboardPhone title={lead.card.title} />}
            <DashboardFloats />
          </div>

          <div>
            <h2 className="gs-mkt-section-title" data-stacked="true">
              <span>Ein Dashboard.</span>
              <span className="gs-mkt-em">Alle Momente.</span>
            </h2>

            <p className="gs-mkt-section-sub">
              WhatsApp-Gruppen, private Kameras, Bewertungen auf fremden Portalen — heute landet
              jede Erfahrung woanders. Momento bündelt sie hinter einem einzigen QR-Code: sortiert,
              moderierbar, an einer Stelle statt in fünf Kanälen.
            </p>

            <ul className="gs-mkt-checklist">
              {CHECKLIST.map((line) => (
                <li key={line}>
                  <MktIcon name="check" size={22} />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
