import type { ReactElement } from 'react'

import type { IconName } from '@/lib/marketing/icons'

import { MktIcon } from '../_components/icons'

/**
 * „Warum Momento" — der Abschnitt zwischen Versprechen und Beweis.
 *
 * Drei Aussagen, die zusammen die Ausgangslage beschreiben: Erfahrungen entstehen heute an einem
 * Ort und landen an fünf anderen. Bewusst KEINE Funktionsliste — die steht weiter unten bei den
 * Anlässen und bei den Tarifen, wo sie aus den Registries kommt.
 *
 * Zwei Korrekturen gegenüber der Design-Vorlage, beide aus demselben Grund (die Vorlage bewirbt
 * eine größere Software, als es sie gibt):
 *
 * - „Ein zentrales Dashboard für dein ganzes Team" — ein Tenant ist heute genau EIN Auth-Nutzer
 *   (`docs/vision.md`, Punkt C2). Es gibt keine zweite Anmeldung, die man einladen könnte.
 * - „DSGVO by Default: Hosting in Deutschland, Auftragsverarbeitung geklärt" — der Speicherort
 *   ist unbestätigt und der AV-Vertrag nach Art. 28 DSGVO steht aus. Beides sind Rechtsaussagen,
 *   keine Werbetexte. An ihre Stelle tritt, was die Software wirklich tut und was der
 *   Datenschutz-Abschnitt weiter unten im Einzelnen zeigt.
 */
type Pillar = {
  icon: IconName
  accent: 'red' | 'yellow' | 'green'
  title: string
  body: string
}

const PILLARS: readonly Pillar[] = [
  {
    icon: 'album',
    accent: 'red',
    title: 'Alles an einem Ort',
    body: 'Fotos, Videos, Bewertungen und Grüße laufen in einer Kampagne zusammen — sortiert, moderierbar, an einer Stelle statt in fünf Kanälen.',
  },
  {
    icon: 'bolt',
    accent: 'yellow',
    title: 'Null Reibung',
    body: 'Keine App, kein Konto, kein Formular. Kamera öffnen, scannen, teilen — auf jedem Smartphone, das einen QR-Code lesen kann.',
  },
  {
    icon: 'shield',
    accent: 'green',
    title: 'Datenschutz eingebaut',
    body: 'Einwilligung mit Zeitstempel, Moderation und ein echter Löschpfad gehören zum Ablauf — nicht zu einer späteren Ausbaustufe.',
  },
]

export function Problem(): ReactElement {
  return (
    <div className="gs-mkt-shell">
      <section id="loesung" className="gs-mkt-section">
        <div className="gs-mkt-section-head">
          <p className="gs-mkt-kicker">▪ Warum Momento</p>
          <h2>
            Schluss mit zerstreuten <span className="gs-mkt-em">Erinnerungen</span>.
          </h2>
          <p className="gs-mkt-section-sub">
            WhatsApp-Gruppen, private Kameras, Bewertungen auf fremden Portalen — jede Erfahrung
            landet woanders. Momento bündelt sie hinter einem einzigen QR-Code.
          </p>
        </div>

        <div className="gs-mkt-pillars">
          {PILLARS.map((pillar) => (
            <article key={pillar.title} className="gs-mkt-pillar" data-accent={pillar.accent}>
              <div className="gs-mkt-pillar-icon">
                <MktIcon name={pillar.icon} size={28} />
              </div>
              <h3>{pillar.title}</h3>
              <p>{pillar.body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
