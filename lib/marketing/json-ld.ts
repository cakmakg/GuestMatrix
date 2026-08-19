import { BRAND } from '@/lib/brand'

import { FAQ_ITEMS } from './faq'

/**
 * Die strukturierten Daten der Startseite (schema.org, JSON-LD).
 *
 * Zweck: Suchmaschinen lesen hier maschinell, was ein Mensch auf der Seite liest. Deshalb ist es
 * eine REINE Funktion über denselben Daten (`FAQ_ITEMS`) und keine zweite, abgeschriebene
 * Fassung — eine Antwort, die im Markup steht und im JSON-LD anders lautet, ist bei Google ein
 * Verstoß und beim Nachbessern die wahrscheinlichste Fehlerquelle.
 *
 * Rein auch, damit sie ohne Request testbar bleibt: die Adresse kommt als Parameter herein
 * (`configuredOrigin()` in der Seite), nicht aus der Umgebung.
 *
 * BEWUSST NICHT enthalten:
 * - `Organization` — sie trüge Rechtsform, Anschrift und Kontakt eines Unternehmens. Genau die
 *   Angaben stehen im Impressum noch aus; erfunden werden sie nicht (siehe /impressum).
 * - `SoftwareApplication` mit `offers` — das ist eine Preisauszeichnung, und eine Kasse gibt es
 *   noch nicht (`lib/marketing/pricing.ts`).
 * - `AggregateRating`/`Review` — es gibt keine Bewertungen der Plattform. Ausgedachte Sterne sind
 *   der klassische Weg zur manuellen Abstrafung.
 */
type JsonLdValue = string | number | boolean | null | JsonLdValue[] | { [key: string]: JsonLdValue }

export type JsonLdDocument = { [key: string]: JsonLdValue }

export function buildLandingJsonLd(origin: string): JsonLdDocument {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${origin}/#website`,
        name: BRAND.name,
        url: `${origin}/`,
        description: `${BRAND.name} — ${BRAND.slogan}`,
        inLanguage: 'de-DE',
      },
      {
        '@type': 'FAQPage',
        '@id': `${origin}/#faq`,
        // Rich Results zeigt Google für FAQ-Auszeichnungen seit 2023 nur noch wenigen Domains.
        // Die Auszeichnung bleibt trotzdem: sie ist eine korrekte, maschinenlesbare Fassung der
        // Antworten — und die lesen inzwischen mehr Systeme als Google.
        mainEntity: FAQ_ITEMS.map((item) => ({
          '@type': 'Question',
          '@id': `${origin}/#faq-${item.id}`,
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      },
    ],
  }
}

/**
 * JSON für ein <script>-Element.
 *
 * `<` wird escaped, weil eine Zeichenkette mit „</script>" das Element sonst vorzeitig schlösse
 * und der Rest als Markup im Dokument landete. Die Texte hier sind eigene Konstanten, in denen
 * das heute nicht vorkommt — die Zeile kostet nichts und hält die Stelle auch dann dicht, wenn
 * hier später ein Wert aus der Datenbank steht.
 */
export function serializeJsonLd(document: JsonLdDocument): string {
  return JSON.stringify(document).replace(/</g, '\\u003c')
}
