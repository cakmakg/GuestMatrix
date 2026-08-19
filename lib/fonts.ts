import { JetBrains_Mono, Playfair_Display, Space_Grotesk } from 'next/font/google'

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

/**
 * Schriften der MARKETING-Fläche (`app/(marketing)`, `[data-surface='marketing']`).
 *
 * Bewusst nicht die Schriften der Anwendung: die Landing-Page ist die Fläche der Plattform-Marke,
 * das Dashboard die Arbeitsfläche des Kunden. Beide Sätze stehen hier zusammen, damit es bei vier
 * Familien genau EINEN Ort gibt, an dem Subset und Schnitte gepflegt werden.
 *
 * Eingehängt werden sie allein im Marketing-Layout — sie landen also nicht im Dashboard-Bundle.
 *
 * Selbst gehostet über next/font: der <link> auf fonts.googleapis.com aus der Design-Vorlage
 * scheitert an der CSP (`style-src 'self'`, `font-src 'self'` in next.config.ts). Das ist der
 * Grund, warum die Vorlage an dieser Stelle nicht 1:1 übernommen werden kann.
 */
export const marketingDisplayFont = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-mkt-display',
  display: 'swap',
})

/**
 * Fließtext der Marketing-Fläche. Eine Monospace als Lauftext ist eine Gestaltungsentscheidung
 * der Vorlage (technischer, gedruckter Ton) — deshalb nur hier und nicht in der Anwendung, wo
 * Tabellen und Listen die schmalere Archivo brauchen.
 */
export const marketingBodyFont = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mkt-mono',
  display: 'swap',
})
