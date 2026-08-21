import type { ReactElement } from 'react'

import { TESTIMONIALS } from '@/lib/marketing/testimonials'

/**
 * Kundenstimmen — heute unsichtbar, weil es keine gibt.
 *
 * Die Design-Vorlage füllt diesen Abschnitt mit drei ausformulierten Bewertungen (Namen, Daten,
 * fünf Sterne, Google-Logo) und der Überschrift „5,0 Sterne auf Google · 15 Bewertungen".
 * Nichts davon existiert. Die Begründung, warum das nicht bloß Platzhaltertext ist, steht bei
 * den Daten (`lib/marketing/testimonials.ts`).
 *
 * `null` statt einer leeren Hülle: ein Abschnitt mit Überschrift und drei leeren Kacheln sähe
 * aus wie ein Ladefehler. Fehlt der Abschnitt, hat die Seite einfach einen weniger — und in dem
 * Moment, in dem die erste echte Stimme in der Registry steht, erscheint er von selbst.
 *
 * Auch die Kopfzeile ist deshalb abgeleitet: die Anzahl steht nicht als Text, sondern kommt aus
 * der Liste. Eine Zahl, die man von Hand pflegt, ist die Zahl, die als Erstes nicht mehr stimmt.
 */
export function Testimonials(): ReactElement | null {
  if (TESTIMONIALS.length === 0) return null

  return (
    <section className="gs-mkt-section" data-tone="paper">
      <div className="gs-mkt-shell">
        <div className="gs-mkt-section-head" data-align="center">
          <p className="gs-mkt-kicker">Was Kunden sagen</p>
          <h2 className="gs-mkt-section-title">
            Aus der <span className="gs-mkt-em">Beta</span>.
          </h2>
        </div>

        <div className="gs-mkt-quotes">
          {TESTIMONIALS.map((testimonial) => (
            <figure key={testimonial.name} className="gs-mkt-quote">
              <div className="gs-mkt-quote-head">
                <div>
                  <div className="gs-mkt-quote-name">{testimonial.name}</div>
                  <p className="gs-mkt-quote-role">{testimonial.role}</p>
                </div>
                {testimonial.rating !== undefined && (
                  <span
                    className="gs-mkt-quote-stars"
                    aria-label={`${testimonial.rating} von 5 Sternen`}
                  >
                    {'★'.repeat(testimonial.rating)}
                  </span>
                )}
              </div>

              <blockquote className="gs-mkt-quote-body">{testimonial.quote}</blockquote>

              {/* Die Herkunft steht sichtbar dabei, nicht nur im Datensatz: eine Stimme, deren
                  Quelle man nicht nennen mag, gehört nicht auf die Seite. */}
              <figcaption className="gs-mkt-quote-source">{testimonial.source}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
