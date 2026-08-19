import type { MetadataRoute } from 'next'

import { configuredOrigin } from '@/lib/app-url'

/**
 * /sitemap.xml
 *
 * Heute genau ein Eintrag, und das ist richtig so: eine Sitemap listet, was in den Index SOLL.
 *
 * - `/impressum` und `/datenschutz` tragen `noindex` (Pflichtdokumente, noch nicht ausgefüllt) —
 *   ein Eintrag hier wäre ein Widerspruch im selben Atemzug.
 * - `/login`, `/signup` und die Passwort-Seiten sind Formulare ohne Inhalt; sie sind erlaubt
 *   (siehe robots.ts), aber nichts, wofür jemand eine Suchanfrage stellt.
 * - `/e/…` gehört nie hierher: das sind Gästeseiten mit personenbezogenen Daten.
 *
 * Die Adresse ist die veröffentlichte (`NEXT_PUBLIC_APP_URL`), nicht der Host des Requests: eine
 * Sitemap wird von fremden Systemen gelesen und gespeichert, genau wie ein Link in einer Mail
 * (siehe lib/app-url.ts).
 *
 * `lastModified` wird beim Build ausgewertet — die Datei ist statisch. Das ist der ehrlichere
 * Wert als ein gepflegtes Datum: die Startseite ändert sich mit dem Deployment.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${configuredOrigin()}/`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
  ]
}
