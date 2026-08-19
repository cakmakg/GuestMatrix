import Link from 'next/link'
import type { ReactElement } from 'react'

import type { IconName } from '@/lib/marketing/icons'

import { MktIcon } from '../_components/icons'

/**
 * Der Datenschutz-Abschnitt — in der Design-Vorlage gibt es ihn NICHT.
 *
 * Er steht hier trotzdem, und zwar an der wichtigsten Stelle: kurz vor dem Schlussbanner. Wer
 * fremde Gäste fotografieren lässt, entscheidet sich nicht für Funktionen, sondern dafür, ob er
 * sich mit dieser Software vor seine Gäste stellen kann. Die Vorlage beantwortete das mit einer
 * Kachel („Hosting in Deutschland, Auftragsverarbeitung geklärt") — beides ist heute nicht
 * belegbar und deshalb gestrichen.
 *
 * Was hier steht, ist stattdessen genau das, was der Code tut, und jeder Satz ist im Repository
 * nachweisbar:
 *
 * - Einwilligung: `submissions.consent_at` (not null) — der Zeitpunkt, nicht bloß ein Häkchen.
 * - Sperre: die Gast-Policies der RLS tragen `moderation_flag = false` im Prädikat
 *   (0001, 0002, 0018, 0021) — eine gesperrte Zeile ist für Gäste nicht abfragbar, nicht bloß
 *   ausgeblendet.
 * - Löschen: der Löschpfad entfernt die Datei aus dem Storage und markiert die Zeile; schlägt
 *   das Entfernen fehl, bleibt beides stehen, statt eine Löschung vorzutäuschen.
 * - Trennung: RLS auf jeder Tabelle (CLAUDE.md, „Absolute Regeln").
 *
 * Der Cookie-Satz am Ende ist eine Zusage mit Verfallsdatum: Er stimmt genau so lange, wie diese
 * Fläche keine Analyse-Skripte lädt. Wer hier Analytics einbaut, muss diesen Absatz ändern UND
 * ein Banner bauen — nicht das eine ohne das andere.
 */
type Guarantee = {
  icon: IconName
  title: string
  body: string
}

const GUARANTEES: readonly Guarantee[] = [
  {
    icon: 'clock',
    title: 'Einwilligung mit Zeitstempel',
    body: 'Ohne Zustimmung kein Beitrag. Gespeichert wird nicht nur, DASS zugestimmt wurde, sondern wann.',
  },
  {
    icon: 'eye',
    title: 'Sperren wirkt sofort',
    body: 'Ein gesperrter Beitrag verschwindet für Gäste — die Sperre steckt in der Datenbank, nicht in der Ansicht.',
  },
  {
    icon: 'trash',
    title: 'Löschen heißt löschen',
    body: 'Der Löschpfad nimmt die Datei aus dem Speicher, nicht nur den Eintrag aus deiner Liste.',
  },
  {
    icon: 'lock',
    title: 'Betriebe bleiben getrennt',
    body: 'Kein Betrieb sieht die Daten eines anderen. Diese Grenze zieht die Datenbank selbst, nicht die Anwendung darüber.',
  },
]

export function Privacy(): ReactElement {
  return (
    <div className="gs-mkt-shell">
      <section id="datenschutz" className="gs-mkt-section">
        <div className="gs-mkt-section-head">
          <p className="gs-mkt-kicker">▪ Datenschutz</p>
          <h2>
            Gästemedien sind <span className="gs-mkt-em">personenbezogene Daten</span>.
          </h2>
          <p className="gs-mkt-section-sub">
            Deine Gäste geben dir ihr Gesicht, ihre Stimme und ihre Meinung. Das ist kein
            Inhaltstyp, sondern ein Vertrauensvorschuss — die vier Punkte gelten deshalb in jeder
            Kampagne, nicht als Zusatz.
          </p>
        </div>

        <ul className="gs-mkt-guarantees">
          {GUARANTEES.map((guarantee) => (
            <li key={guarantee.title} className="gs-mkt-guarantee">
              <MktIcon name={guarantee.icon} size={26} />
              <h3>{guarantee.title}</h3>
              <p>{guarantee.body}</p>
            </li>
          ))}
        </ul>

        <p className="gs-mkt-privacy-note">
          Diese Seite lädt keine Analyse- oder Werbeskripte; gesetzt wird nur, was Anmeldung und
          Beitrag technisch brauchen. Deshalb steht hier auch kein Cookie-Banner. Einzelheiten in
          der <Link href="/datenschutz">Datenschutzerklärung</Link>.
        </p>
      </section>
    </div>
  )
}
