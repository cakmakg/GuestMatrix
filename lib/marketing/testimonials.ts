/**
 * Kundenstimmen — heute leer, und das ist der Punkt.
 *
 * Die Design-Vorlage bringt an dieser Stelle drei ausformulierte Bewertungen mit Namen, Datum,
 * fünf Sternen und dem Google-Logo mit, dazu die Überschrift „5,0 Sterne auf Google · 15
 * Bewertungen". Nichts davon existiert: es gibt kein Google-Profil, keine 15 Bewertungen und
 * keine dieser drei Personen. Erfundene Bewertungen auf einer verkaufenden Seite sind keine
 * Gestaltung, sondern eine Täuschung des Lesers — in Deutschland zudem abmahnfähig (§ 5 UWG,
 * seit 2022 ausdrücklich für gefälschte Verbraucherbewertungen).
 *
 * Deshalb steht hier eine leere Liste statt einer gefüllten. Der Abschnitt
 * (`_sections/Testimonials.tsx`) rendert bei leerer Liste GAR NICHTS — die Seite hat dann keine
 * Lücke, sondern einen Abschnitt weniger. Kommt die erste echte Stimme, wird sie hier
 * eingetragen und der Abschnitt erscheint von selbst.
 *
 * `source` ist Pflicht und keine Zierde: sie zwingt den Eintragenden zu benennen, WO die Stimme
 * herkommt. Eine Aussage ohne nachvollziehbare Herkunft gehört nicht auf die Seite.
 */
export type Testimonial = {
  /** Name, wie ihn die Person selbst nennen möchte — mit ihrer Zustimmung zur Nennung. */
  name: string
  /** Betrieb und Rolle („Hotel Adler · Rezeption"). */
  role: string
  quote: string
  /** Woher die Stimme stammt: „E-Mail vom 12.03.2026", „Beta-Gespräch", „Google-Rezension". */
  source: string
  /** Nur setzen, wenn die Person tatsächlich eine Sternebewertung abgegeben hat. */
  rating?: 1 | 2 | 3 | 4 | 5
}

export const TESTIMONIALS: readonly Testimonial[] = []
