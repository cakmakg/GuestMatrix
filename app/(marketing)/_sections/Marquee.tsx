import type { ReactElement } from 'react'

import { MARKETING_SEGMENTS } from '@/lib/marketing/segments'

/**
 * Das Laufband unter dem Hero — der Übergang vom Versprechen zur Erklärung.
 *
 * Es trägt einen Teil dessen, was der Hero mit dem Sektor-Wechsler verloren hat: die Breite der
 * Anlässe. Deshalb kommt die erste Hälfte der Wörter aus der Registry und nicht aus diesem
 * Text — es läuft genau das durchs Bild, was die Registrierung auch anbietet.
 *
 * Die Vorlage nannte zusätzlich „Firmenevents", „Galas", „Konferenzen", „Meetups" und
 * „Retreats". Das sind keine aktiven Geschäftsarten (`SIGNUP_OPTIONS` kennt Hotel, Reiseagentur
 * und Hochzeit/Event) — ein Laufband, das Konferenzen bewirbt, verspricht einen Sektor, den es
 * nicht gibt. An ihre Stelle treten Dinge, die ein Gast in JEDER Kampagne hinterlässt.
 */
const CONTRIBUTIONS: readonly string[] = ['Fotos', 'Videobotschaften', 'Feedback', 'Ein QR-Code']

export function Marquee(): ReactElement {
  const words = [...MARKETING_SEGMENTS.map((segment) => segment.useCase.title), ...CONTRIBUTIONS]

  return (
    <div className="gs-mkt-marquee">
      {/* Zwei identische Spuren, die zusammen um genau die Hälfte wandern: am Ende der Schleife
          steht wieder derselbe Anblick wie am Anfang, also kein sichtbarer Sprung. Die zweite
          Spur ist `aria-hidden`, sonst läse ein Screenreader jedes Wort doppelt. */}
      <div className="gs-mkt-marquee-track">
        <ul className="gs-mkt-marquee-row">
          {words.map((word) => (
            <li key={word}>{word}</li>
          ))}
        </ul>
        <ul className="gs-mkt-marquee-row" aria-hidden="true">
          {words.map((word) => (
            <li key={word}>{word}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
