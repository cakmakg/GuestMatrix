import type { ReactElement } from 'react'

import { configuredOrigin } from '@/lib/app-url'
import { buildLandingJsonLd, serializeJsonLd } from '@/lib/marketing/json-ld'

import { Faq } from './_sections/Faq'
import { FeatureStrip } from './_sections/FeatureStrip'
import { FinalCta } from './_sections/FinalCta'
import { Hero } from './_sections/Hero'
import { HowItWorks } from './_sections/HowItWorks'
import { Pricing } from './_sections/Pricing'
import { Privacy } from './_sections/Privacy'
import { Problem } from './_sections/Problem'
import { UseCases } from './_sections/UseCases'

/**
 * Startseite.
 *
 * Fast vollständig statisch: die Seite fragt bewusst NICHT, ob jemand angemeldet ist. Wer schon
 * Kunde ist, klickt „Anmelden" und wird von der Middleware ohnehin nach /dashboard geschickt
 * (middleware.ts, Regel 5). Eine Sitzungsabfrage hier würde bei jedem Besuch eine Runde zu
 * Supabase kosten und den ersten Bildschirm verzögern, ohne etwas zu ändern.
 *
 * Die Reihenfolge ist die Reihenfolge der Fragen, die ein Besucher stellt: Was ist das (Hero) —
 * warum überhaupt (Lösung) — was muss ich tun (Ablauf) — gilt das für mich (Anlässe) — was kostet
 * es (Preise) — kann ich das meinen Gästen zumuten (Datenschutz) — und der Rest (FAQ).
 *
 * Anlässe und Preise leiten ihre Inhalte aus den Registries ab (`lib/marketing/segments.ts` über
 * `SIGNUP_OPTIONS`, `lib/marketing/pricing.ts` über `lib/plans`) — die Seite bewirbt damit immer
 * genau das, was die Registrierung anbietet.
 */
export default function LandingPage(): ReactElement {
  // Die veröffentlichte Adresse, nicht der Host des Requests: strukturierte Daten werden von
  // fremden Systemen gelesen und gespeichert. Dieselbe Begründung wie bei Links, die wir
  // versenden — der Host-Header kommt vom Client (siehe lib/app-url.ts).
  const jsonLd = serializeJsonLd(buildLandingJsonLd(configuredOrigin()))

  return (
    <>
      <Hero />
      <FeatureStrip />
      <Problem />
      <HowItWorks />
      <UseCases />
      <Pricing />
      <Privacy />
      <Faq />
      <FinalCta />

      {/* Kein next/script: strukturierte Daten sind kein Skript, das ausgeführt wird, sondern ein
          Datenblock, den Crawler im Markup erwarten. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
    </>
  )
}
