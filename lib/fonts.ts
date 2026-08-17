import { Playfair_Display } from 'next/font/google'

/**
 * Anzeigeschrift der gemeinsamen Sprache (`[data-theme]` in app/globals.css) — als
 * `--font-display`. Sie gilt nur für Überschriften; Fließtext, Listen und Tabellen bleiben auf
 * Archivo (`--font-archivo`, app/layout.tsx).
 *
 * Hier und nicht im Layout, weil inzwischen ZWEI Oberflächen sie tragen: das Betreiber-Dashboard
 * und der Gäste-Flow hinter dem QR. Zwei next/font-Aufrufe für dieselbe Familie wären zwei
 * Ladepfade für dieselben Dateien — und zwei Stellen, an denen der Subset auseinanderläuft.
 *
 * Selbst gehostet über next/font: ein @import von fonts.googleapis.com scheitert an der CSP
 * (`style-src 'self'`, `font-src 'self'` in next.config.ts).
 */
export const displayFont = Playfair_Display({
  // latin-ext wegen der türkischen Zeichen in Gäste- und Kampagnennamen (ş, ğ, ı, İ, ö, ü, ç):
  // ohne den Subset fällt genau dort die Ersatzschrift ein, und ein Name wie „Gülşen" bräche
  // mitten im Wort auf zwei Schriften.
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
})
