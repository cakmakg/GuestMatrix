import type { ReactElement } from 'react'

/**
 * „So funktioniert's" — drei Schritte, keiner davon eine Verhandlung, ein Termin oder ein
 * Workshop. Nachfolger von `HowItWorks`.
 *
 * Drei Korrekturen gegenüber der Design-Vorlage:
 *
 * - Überschrift „Vom Scan zur Galerie": eine Galerie hat heute nur der Kampagnentyp `agency`.
 *   Ein Hotel läuft im Feedback-Modus, die Hochzeit im geschlossenen Gästebuch — für zwei von
 *   drei Geschäftsarten wäre der Satz falsch. „Übersicht" stimmt in jeder.
 * - Schritt 1 „mit Ihrem Branding": gästeseitig erscheint heute allein der bei der Registrierung
 *   erfasste Name (`tenants.brand_name`). Es gibt weder Logo-Upload noch Farbwahl noch einen
 *   frei gesetzten Willkommenstext.
 * - Schritt 3 „Exportierbar für Social, Kataloge, Website oder Ihre Bewertungsplattformen": es
 *   gibt keine Anbindung an Bewertungsportale, und der Export gilt nicht überall — das Gästebuch
 *   hat keinen (`FLOW_MODE_CAPABILITIES.guestbook.exportEnabled = false`). Deshalb steht der
 *   Export in der FAQ mit seiner Bedingung und hier nur das, was in JEDER Kampagne stimmt.
 *
 * Die Schritt-Überschriften sind bewusst KEINE Links. In der Vorlage sind sie unterstrichen und
 * tragen ein Pfeilsymbol, zeigen aber auf `#` — es gibt keine Unterseiten, auf die sie führen
 * könnten.
 */
type Step = {
  no: string
  tag: string
  title: string
  body: string
}

const STEPS: readonly Step[] = [
  {
    no: '01',
    tag: '~5 Min',
    title: 'QR-Code erstellen',
    body: 'Geschäftsart wählen, Kampagne anlegen, QR-Code herunterladen. Er trägt deinen Namen und führt direkt auf deine Kampagne — ausdrucken oder digital teilen. Kein Anruf, kein Einrichtungsgespräch.',
  },
  {
    no: '02',
    tag: 'Live',
    title: 'Gäste scannen & teilen',
    body: 'Kein App-Download, keine Anmeldung. Kamera öffnen, Foto oder Video wählen, Rückmeldung hinterlassen — auf jedem Smartphone, das einen QR-Code lesen kann.',
  },
  {
    no: '03',
    tag: 'Jederzeit',
    title: 'Alles im Dashboard',
    body: 'Beiträge kommen sortiert an. Ansehen, sperren, löschen — und die Zahlen dazu, ohne dass du etwas zusammenrechnest.',
  },
]

export function Process(): ReactElement {
  return (
    <section id="ablauf" className="gs-mkt-section">
      <div className="gs-mkt-shell">
        <div className="gs-mkt-section-head" data-align="center">
          <p className="gs-mkt-kicker">So funktioniert&rsquo;s</p>
          <h2 className="gs-mkt-section-title">
            Vom <span className="gs-mkt-em">Scan</span> zur{' '}
            <span className="gs-mkt-em">Übersicht</span>.
          </h2>
        </div>

        <ol className="gs-mkt-steps">
          {STEPS.map((step) => (
            <li key={step.no} className="gs-mkt-step">
              <span className="gs-mkt-step-no" aria-hidden="true">
                {step.no}
              </span>
              <div>
                <div className="gs-mkt-step-head">
                  <h3 className="gs-mkt-step-title">{step.title}</h3>
                  <span className="gs-mkt-step-tag">{step.tag}</span>
                </div>
                <p className="gs-mkt-step-body">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
