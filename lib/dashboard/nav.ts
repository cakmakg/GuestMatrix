/**
 * Navigations-Ziele des Betreiber-Dashboards — die EINZIGE Quelle für beide Darstellungen.
 *
 * Das Dashboard zeigt dieselben Ziele in zwei Formen: als Seitenleiste (Desktop) und als
 * Leiste am unteren Rand (Telefon). Ohne eine gemeinsame Quelle stünde die Liste zweimal im
 * Code und liefe beim nächsten neuen Ziel auseinander — genau die Art Drift, die man erst
 * bemerkt, wenn auf dem Telefon ein Menüpunkt fehlt.
 *
 * Welche Ziele es gibt, leitet sich aus den Fähigkeiten ab (`DashboardCapabilities`), nicht
 * aus dem Sektor: ein Gästebuch-Tenant hat keine Berichte, weil sein Flow-Modus keine
 * Auswertung trägt — nicht, weil er „event" heißt.
 *
 * Rein (kein JSX, kein Next-Runtime): die Symbole liegen in den Komponenten und werden über
 * `id` zugeordnet, damit diese Regeln ohne React testbar bleiben.
 */

import type { DashboardCapabilities, DashboardLabels } from '@/lib/sectors'

export type NavItemId =
  'overview' | 'experiences' | 'responses' | 'media' | 'reports' | 'settings' | 'more' | 'qr'

export type NavItem = {
  id: NavItemId
  href: string
  label: string
}

/**
 * Alle Ziele für die Seitenleiste (Desktop). Reihenfolge = Lesereihenfolge; `reports` entfällt,
 * wenn der Tenant keine Auswertung hat.
 */
export function dashboardNavItems(labels: DashboardLabels, can: DashboardCapabilities): NavItem[] {
  const items: NavItem[] = [
    { id: 'overview', href: '/dashboard', label: 'Übersicht' },
    { id: 'experiences', href: '/dashboard/experiences', label: labels.experiences },
    { id: 'responses', href: '/dashboard/feedback', label: labels.responses },
    { id: 'media', href: '/dashboard/media', label: labels.media },
  ]

  if (can.reportsEnabled) {
    items.push({ id: 'reports', href: '/dashboard/reports', label: 'Berichte' })
  }

  items.push({ id: 'settings', href: '/dashboard/settings', label: 'Einstellungen' })
  return items
}

/**
 * Die vier Ziele der Leiste am unteren Rand (Telefon).
 *
 * Immer GENAU vier: bei 360 px bleiben sonst ~72 px je Eintrag, und die Beschriftung bricht.
 * Innerhalb eines Geschäftsmodells stehen sie fest — eine Leiste, deren Einträge wandern, lässt
 * sich nicht mit dem Daumen lernen.
 *
 * Zwei Belegungen, abgeleitet aus `contributionCentric`:
 *
 * - Sammel-Flow (Gästebuch): Übersicht · Galerie · QR · Einstellungen. Der QR bekommt einen
 *   eigenen Platz, weil er dort die häufigste Handlung überhaupt ist — er steht auf den Tischen
 *   und wird herumgezeigt. Grüße und Medien teilen sich die „Galerie", weil beide dasselbe sind:
 *   das, was die Gäste dagelassen haben. „Mehr" entfällt, es bliebe nichts darin.
 * - Betriebs-Flow (Hotel/Agentur): Übersicht · Antworten · Medien · Mehr. Der QR wird einmal
 *   eingerichtet und dann vergessen; dafür gibt es Berichte und Export hinter „Mehr".
 *
 * `experiences` fehlt in beiden absichtlich: wer nur eine laufende Kampagne hat (Free-Tarif
 * erlaubt genau eine), sieht sie bereits auf der Übersicht.
 */
export function bottomNavItems(labels: DashboardLabels, can: DashboardCapabilities): NavItem[] {
  const overview: NavItem = { id: 'overview', href: '/dashboard', label: 'Übersicht' }

  if (can.contributionCentric) {
    return [
      overview,
      { id: 'media', href: '/dashboard/media', label: 'Galerie' },
      { id: 'qr', href: '/dashboard/qr', label: 'QR-Code' },
      { id: 'settings', href: '/dashboard/settings', label: 'Einstellungen' },
    ]
  }

  return [
    overview,
    { id: 'responses', href: '/dashboard/feedback', label: labels.responses },
    { id: 'media', href: '/dashboard/media', label: labels.media },
    { id: 'more', href: '/dashboard/more', label: 'Mehr' },
  ]
}

/**
 * Was die „Mehr"-Seite auflistet: alles aus der Seitenleiste, was nicht schon in der unteren
 * Leiste steht. Abgeleitet statt zweitgepflegt — ein neues Ziel taucht damit automatisch auf.
 *
 * Der CSV-Export erscheint hier NICHT als eigener Punkt: er hängt immer an einem Zeitraum
 * (Berichte) oder an einer Kampagne (Detailseite) und wäre ohne diesen Kontext eine Datei
 * ohne Bezug.
 */
export function moreNavItems(labels: DashboardLabels, can: DashboardCapabilities): NavItem[] {
  const inBottomBar = new Set(bottomNavItems(labels, can).map((item) => item.id))
  return dashboardNavItems(labels, can).filter((item) => !inBottomBar.has(item.id))
}
