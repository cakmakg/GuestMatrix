import type { ReactElement } from 'react'

import { DashboardMock } from '../_components/DashboardMock'

/**
 * „So funktioniert's" — der dunkle Abschnitt in der Mitte der Seite.
 *
 * Er sitzt bewusst zwischen „Warum Momento" und den Anlässen: Wer bis hierhin gelesen hat, glaubt
 * das Versprechen — jetzt will er wissen, was er selbst tun muss. Drei Schritte, keiner davon
 * eine Verhandlung, ein Termin oder ein Workshop.
 *
 * Die dunkle Fläche kehrt die beiden Akzent-Tokens um (`--mkt-em`, `--mkt-kicker` in
 * globals.css): dieselbe Geste, andere Farbe — Rot auf Papier, Gelb auf Mürbe.
 *
 * Korrektur gegenüber der Vorlage: dort ist Schritt 1 „Branded mit deinem Logo, deinen Farben,
 * deinem Willkommenstext". Gästeseitig erscheint heute allein der bei der Registrierung erfasste
 * Name (`tenants.brand_name`) — es gibt weder Logo-Upload noch Farbwahl noch einen frei
 * gesetzten Willkommenstext. Der Text nennt deshalb nur den Namen.
 */
type Step = {
  no: string
  accent: 'red' | 'orange' | 'yellow'
  title: string
  body: string
}

const STEPS: readonly Step[] = [
  {
    no: '1',
    accent: 'red',
    title: 'QR-Code erstellen',
    body: 'Kampagne anlegen, QR-Code herunterladen. Er trägt deinen Namen und führt direkt auf deine Kampagne — ausdrucken oder digital teilen.',
  },
  {
    no: '2',
    accent: 'orange',
    title: 'Gäste scannen & teilen',
    body: 'Kamera öffnen, Foto oder Video hochladen, Rückmeldung hinterlassen. Keine App, keine Anmeldung, keine Hürde dazwischen.',
  },
  {
    no: '3',
    accent: 'yellow',
    title: 'Alles im Dashboard',
    // „exportierbar" gilt nicht überall: das Gästebuch hat keinen CSV-Export
    // (`FLOW_MODE_CAPABILITIES.guestbook.exportEnabled = false`). Deshalb steht der Export in der
    // FAQ mit seiner Bedingung und hier nur das, was in JEDER Kampagne stimmt.
    body: 'Beiträge kommen sortiert an. Ansehen, sperren, löschen — und die Zahlen dazu, ohne dass du etwas zusammenrechnest.',
  },
]

export function HowItWorks(): ReactElement {
  return (
    <section id="funktion" className="gs-mkt-flow">
      <div className="gs-mkt-shell">
        <div className="gs-mkt-flow-inner">
          <div>
            <p className="gs-mkt-kicker">▪ So funktioniert&rsquo;s</p>
            <h2>
              Drei Schritte. <span className="gs-mkt-em">Kein Extra.</span>
            </h2>
            <p className="gs-mkt-flow-sub">
              Vom ersten Code bis zum ersten Feedback — ohne Termin, ohne Einrichtungsgespräch.
            </p>

            <ol className="gs-mkt-steps">
              {STEPS.map((step) => (
                <li key={step.no} className="gs-mkt-step">
                  <span className="gs-mkt-step-no" data-accent={step.accent}>
                    {step.no}
                  </span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <DashboardMock />
        </div>
      </div>
    </section>
  )
}
