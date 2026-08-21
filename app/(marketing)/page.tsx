import type { ReactElement } from 'react'

import { configuredOrigin } from '@/lib/app-url'
import { buildLandingJsonLd, serializeJsonLd } from '@/lib/marketing/json-ld'

import { Bands } from './_sections/Bands'
import { Faq } from './_sections/Faq'
import { FinalCta } from './_sections/FinalCta'
import { Hero } from './_sections/Hero'
import { Marquee } from './_sections/Marquee'
import { Packages } from './_sections/Packages'
import { Privacy } from './_sections/Privacy'
import { Process } from './_sections/Process'
import { Testimonials } from './_sections/Testimonials'
import { WhyUs } from './_sections/WhyUs'

/**
 * Startseite.
 *
 * Vollständig statisch: die Seite fragt bewusst NICHT, ob jemand angemeldet ist. Wer schon Kunde
 * ist, klickt „Anmelden" und wird von der Middleware ohnehin nach /dashboard geschickt
 * (middleware.ts, Regel 5). Eine Sitzungsabfrage hier würde bei jedem Besuch eine Runde zu
 * Supabase kosten und den ersten Bildschirm verzögern, ohne etwas zu ändern.
 *
 * Seit dem Umbau auf die Vorlage v3 kommt sie zudem ohne eine einzige `"use client"`-Insel aus:
 * der Sektor-Wechsler im Hero ist einer Telefon-Attrappe gewichen, deren drei Zustände über
 * CSS-Keyframes laufen. Es liegt kein JavaScript dieser Seite im Browser-Bündel.
 *
 * ── Die Reihenfolge ist die Reihenfolge der Fragen eines Besuchers ────────
 * Was ist das (Hero) — für wen (Laufband) — warum überhaupt (Warum Momento) — gilt das für mich
 * und was kostet es (Pakete) — was muss ich tun (Ablauf) — sagt das noch jemand außer euch
 * (Stimmen) — kann ich das meinen Gästen zumuten (Datenschutz) — und der Rest (FAQ).
 *
 * Die Stimmen erscheinen erst, wenn es welche gibt: `Testimonials` liefert `null`, solange
 * `lib/marketing/testimonials.ts` leer ist. Erfundene Bewertungen stehen dort nicht.
 *
 * Pakete und Preise leiten ihre Inhalte aus den Registries ab (`lib/marketing/segments.ts` über
 * `SIGNUP_OPTIONS`, `lib/marketing/pricing.ts` über `lib/plans`) — die Seite bewirbt damit immer
 * genau das, was die Registrierung anbietet.
 *
 * ── Anker ────────────────────────────────────────────────────────────────
 * `#warum`, `#pakete`, `#ablauf`, `#datenschutz`, `#faq`. Kopfleiste und Fuß zeigen darauf; die
 * FAQ-Sprungmarken (`#faq-<id>`) stehen zusätzlich im JSON-LD. Wer einen Anker umbenennt, muss
 * alle drei Stellen mitnehmen — ein Menüpunkt ohne Ziel tut nichts und meldet auch nichts.
 */
export default function LandingPage(): ReactElement {
  // Die veröffentlichte Adresse, nicht der Host des Requests: strukturierte Daten werden von
  // fremden Systemen gelesen und gespeichert. Dieselbe Begründung wie bei Links, die wir
  // versenden — der Host-Header kommt vom Client (siehe lib/app-url.ts).
  const jsonLd = serializeJsonLd(buildLandingJsonLd(configuredOrigin()))

  return (
    <>
      <Hero />
      <Marquee />
      <WhyUs />
      {/* Die Bildbänder der Vorlage. Sie erscheinen, sobald `images` gefüllt ist — heute nicht,
          weil es keine freigegebenen Aufnahmen gibt (siehe `_sections/Bands.tsx`). */}
      <Bands />
      <Packages />
      <Bands tone="paper" />
      <Process />
      <Testimonials />
      <Privacy />
      <Faq />
      <FinalCta />

      {/* Kein next/script: strukturierte Daten sind kein Skript, das ausgeführt wird, sondern ein
          Datenblock, den Crawler im Markup erwarten. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
    </>
  )
}
