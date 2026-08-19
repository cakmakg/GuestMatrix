import type { MetadataRoute } from 'next'

import { configuredOrigin } from '@/lib/app-url'

/**
 * /robots.txt
 *
 * Der wichtigste Eintrag ist `/e/`: dort liegt der Gäste-Flow hinter dem QR-Code, und was ein
 * Gast dort hochlädt, sind personenbezogene Daten. Diese Adressen sind nirgends verlinkt — sie
 * stehen auf einem Aufsteller im Hotel oder auf einer Tischkarte. Ein Crawler, der auf einem
 * geposteten Foto oder in einer Browserleiste darüber stolpert, soll sie nicht in einen Index
 * tragen.
 *
 * ACHTUNG, was das NICHT ist: robots.txt ist keine Zugriffskontrolle. Sie ist eine Bitte an
 * gutwillige Crawler. Wer die Datei ignoriert, kommt genauso weit wie vorher — die eigentliche
 * Grenze zieht die RLS. Und ein per Disallow gesperrter Pfad kann trotzdem im Index landen,
 * wenn jemand ihn verlinkt; dagegen hilft nur `noindex` auf der Seite selbst (steht dort).
 *
 * `/dashboard/` und `/api/` sind ohne Anmeldung ohnehin unerreichbar (middleware.ts, Regel 4);
 * sie stehen hier, damit niemand Crawl-Budget auf Weiterleitungen zur Anmeldung verbrennt.
 *
 * Die Anmeldeseiten bleiben bewusst offen: `/signup` ist ein Ziel, auf das die Startseite
 * dreimal zeigt — es zu sperren wäre ein Widerspruch zur Seite selbst.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/dashboard/', '/e/'],
      },
    ],
    sitemap: `${configuredOrigin()}/sitemap.xml`,
  }
}
