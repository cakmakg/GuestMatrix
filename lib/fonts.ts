import { DM_Serif_Display, Manrope, Playfair_Display } from 'next/font/google'

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

/**
 * Anzeigeschrift der Marketing-Fläche.
 *
 * DM Serif Display gibt es NUR in einem Schnitt (400) — das ist keine Auslassung, die Familie hat
 * keinen zweiten. Die Vorlage baut ihre Hierarchie deshalb über Grad und Kursive, nicht über
 * Fettung: `font-weight: 700` auf einer Überschrift ergäbe hier eine vom Browser gerechnete
 * Kunstfettung. globals.css setzt an den Überschriften darum ausdrücklich `font-weight: 400`.
 *
 * `Playfair Display` steht in der Vorlage als Rückfall und ist über `displayFont` ohnehin im
 * Projekt — aber NICHT auf dieser Fläche eingehängt. Als Rückfallname bleibt sie trotzdem
 * sinnvoll: sie greift nur, wenn der Besucher sie lokal installiert hat.
 */
export const marketingDisplayFont = DM_Serif_Display({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-mkt-display',
  display: 'swap',
})

/**
 * Fließtext der Marketing-Fläche.
 *
 * Manrope statt der bisherigen Monospace: die neue Vorlage setzt einen editorialen Ton (Serifen
 * für die Aussage, ruhige Grotesk für alles andere). Die vier Schnitte werden alle gebraucht —
 * 400 im Fließtext, 500/600 in Marken- und Navigationszeilen, 700 in den Kennzahlen.
 */
export const marketingBodyFont = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mkt-sans',
  display: 'swap',
})
