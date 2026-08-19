import type { ReactElement } from 'react'

import { FAQ_ITEMS } from '@/lib/marketing/faq'

/**
 * Die häufigen Fragen — mit `<details>`/`<summary>` statt eigener Auf-/Zu-Logik.
 *
 * Das Element bringt Tastaturbedienung, Screenreader-Ansage und den Zustand selbst mit; eine
 * nachgebaute Ziehharmonika bräuchte `"use client"`, ARIA-Attribute und wäre vor der Hydration
 * geschlossen und stumm. Hier funktioniert der Abschnitt ohne eine Zeile JavaScript.
 *
 * Die IDs (`faq-<id>`) sind die Sprungmarken, auf die das JSON-LD zeigt (`buildLandingJsonLd`) —
 * deshalb stehen sie hier und nicht als laufende Nummer.
 *
 * Die Texte stehen in `lib/marketing/faq.ts`, weil sie zwei Abnehmer haben (Abschnitt und
 * strukturierte Daten). Neue Fragen gehören DORTHIN, nicht in diese Datei.
 */
export function Faq(): ReactElement {
  return (
    <div className="gs-mkt-shell">
      <section id="faq" className="gs-mkt-section">
        <div className="gs-mkt-section-head">
          <p className="gs-mkt-kicker">▪ Häufige Fragen</p>
          <h2>
            Bevor du <span className="gs-mkt-em">fragst</span>.
          </h2>
        </div>

        <div className="gs-mkt-faq">
          {FAQ_ITEMS.map((item) => (
            <details key={item.id} id={`faq-${item.id}`} className="gs-mkt-faq-item">
              <summary>
                <span>{item.question}</span>
                {/* Rein grafisch: das Zeichen wechselt per CSS mit dem offenen Zustand. Das
                    Element sagt seinen Zustand bereits selbst an, ein zweites Mal als Text wäre
                    im Screenreader Doppelung. */}
                <i aria-hidden="true" />
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}
