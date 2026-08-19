import type { Metadata } from 'next'
import type { ReactElement, ReactNode } from 'react'

import { configuredOrigin } from '@/lib/app-url'
import { BRAND } from '@/lib/brand'
import { marketingBodyFont, marketingDisplayFont } from '@/lib/fonts'

import { MarketingFooter } from './_sections/MarketingFooter'
import { MarketingHeader } from './_sections/MarketingHeader'

/**
 * Gerüst der öffentlichen Fläche (Startseite, Rechtstexte).
 *
 * `data-surface="marketing"` ist der einzige Schalter: er hängt in globals.css den kompletten
 * --mkt-Tokensatz ein und hebt ihn über `body:has(…)` bis auf den Seitengrund. Dieselbe Achse
 * wie `data-theme` im Dashboard, nur eine andere Fläche — und bewusst kein `data-theme`, weil
 * hier eigene Bauteile stehen und nicht bloß andere Werte derselben Sprache.
 *
 * Die beiden Schriften hängen an DIESEM Knoten und nicht am Wurzel-Layout: so lädt das
 * Dashboard sie nie mit.
 */
const DESCRIPTION =
  'Sammle Fotos, Videos und Feedback direkt von deinen Gästen — mit einem einzigen QR-Code. ' +
  'Ohne App, ohne Anmeldung, DSGVO-konform.'

const TITLE = `${BRAND.name} — ${BRAND.slogan}`

/**
 * `metadataBase` ist die VERÖFFENTLICHTE Adresse (`NEXT_PUBLIC_APP_URL`), nicht der Host des
 * Requests: ohne sie bleiben og:image und canonical relativ — und eine relative Adresse ist
 * genau das, was ein fremdes System (Vorschaukarte im Messenger, Suchindex) nicht auflösen kann.
 * Dieselbe Einordnung wie bei Links, die wir versenden; siehe lib/app-url.ts.
 *
 * Das Vorschaubild steht NICHT in diesem Objekt: `opengraph-image.tsx` in diesem Ordner erzeugt
 * es und trägt sich selbst in die Metadaten aller Seiten dieser Fläche ein.
 */
export const metadata: Metadata = {
  metadataBase: new URL(configuredOrigin()),
  title: {
    default: TITLE,
    template: `%s – ${BRAND.name}`,
  },
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'de_DE',
    siteName: BRAND.name,
    title: TITLE,
    description: DESCRIPTION,
    url: '/',
  },
  // Ohne Kartentyp zeigt X eine briefmarkengroße Vorschau; die Grafik ist auf 1200×630 gebaut
  // und braucht die große Karte.
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
}

export default function MarketingLayout({ children }: { children: ReactNode }): ReactElement {
  return (
    <div
      className={`gs-mkt ${marketingDisplayFont.variable} ${marketingBodyFont.variable}`}
      data-surface="marketing"
    >
      <MarketingHeader />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  )
}
