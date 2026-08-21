import { describe, expect, it } from 'vitest'

import { TESTIMONIALS } from '@/lib/marketing/testimonials'

/**
 * Kundenstimmen dürfen nicht erfunden werden.
 *
 * Die Design-Vorlage bringt drei ausformulierte Bewertungen mit Namen, Datum, fünf Sternen und
 * Google-Logo mit, dazu „5,0 Sterne auf Google · 15 Bewertungen". Nichts davon existiert.
 * Gefälschte Verbraucherbewertungen sind seit 2022 ausdrücklich unlauter (§ 5 Abs. 3 UWG) —
 * das ist kein Gestaltungsdetail, sondern ein Rechtsrisiko.
 *
 * Der Test kann nicht prüfen, ob eine Stimme ECHT ist. Er kann aber verhindern, dass eine ohne
 * benannte Herkunft hineinrutscht — und genau daran scheitert der Copy-Paste aus der Vorlage.
 */
describe('Kundenstimmen', () => {
  it('ist heute leer — es gibt keine Beta-Kunden mit Freigabe', () => {
    // Fällt dieser Test, ist das kein Fehler: dann hat jemand die erste echte Stimme eingetragen.
    // Diese Zeile ist dann zu löschen, und der Abschnitt erscheint auf der Startseite.
    expect(TESTIMONIALS).toHaveLength(0)
  })

  it.each(TESTIMONIALS)('$name nennt eine überprüfbare Herkunft', (testimonial) => {
    expect(testimonial.source.trim().length).toBeGreaterThan(0)
    expect(testimonial.name.trim().length).toBeGreaterThan(0)
    expect(testimonial.role.trim().length).toBeGreaterThan(0)
  })

  it('behauptet keine Bewertung ohne Sterne und keine Sterne ohne Bewertung', () => {
    for (const testimonial of TESTIMONIALS) {
      if (testimonial.rating === undefined) continue
      expect(testimonial.rating).toBeGreaterThanOrEqual(1)
      expect(testimonial.rating).toBeLessThanOrEqual(5)
    }
  })
})
