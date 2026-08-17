'use client'

type Props = {
  /** Was bewertet wird. Trägt die Vorlesbarkeit der Knöpfe („Sauberkeit: 3 Sterne"). */
  label: string
  value: number
  onChange: (value: number) => void
}

const STARS = [1, 2, 3, 4, 5] as const

// Ein Pfad, fünf Zacken. Gefüllt = gewählt, Kontur = offen (siehe `.gs-guest-star` in globals.css).
const STAR_PATH =
  'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'

/**
 * Sternebewertung des Gäste-Flows — eine Stelle für Gesamtnote UND Zusatzfragen, in drei Flows.
 *
 * Vorher standen die Sterne als Textglyphen (★/☆) dreimal im Markup: als 36px-Glyphe für die
 * Gesamtnote und als 24px-Glyphe je Zusatzfrage. Die kleine Variante verfehlte die 44px-
 * Trefferfläche aus docs/mobile-smoke-test.md deutlich — auf einem Telefon war das Treffen der
 * dritten von fünf Zacken Glückssache. Die Grafik löst zugleich ein Darstellungsproblem: welche
 * Glyphe eine Schrift für ☆ liefert, entscheidet die Schrift, nicht wir.
 */
export function GuestStars({ label, value, onChange }: Props) {
  return (
    <div className="gs-guest-stars">
      {STARS.map((star) => (
        <button
          key={star}
          type="button"
          className="gs-guest-star"
          // Gefüllt sind alle Sterne bis zur Wahl (Anzeige), „gedrückt" ist genau die Wahl selbst
          // (Bedeutung) — sonst hörte ein Screenreader bei 3 von 5 drei gedrückte Knöpfe.
          data-on={star <= value}
          aria-pressed={star === value}
          aria-label={`${label}: ${star} ${star === 1 ? 'Stern' : 'Sterne'}`}
          onClick={() => onChange(star)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={STAR_PATH} />
          </svg>
        </button>
      ))}
    </div>
  )
}
