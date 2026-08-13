/**
 * Die drei Kennzahlen über einer einzelnen Kampagne (Übersicht im Ein-Kampagnen-Fall).
 *
 * Drei, nicht fünf: auf dem Telefon ist eine Reihe aus drei Zahlen das, was ohne Scrollen und
 * ohne Nachdenken lesbar bleibt. Welche drei, hängt am Flow-Modus — nicht am Sektor:
 *
 *   Hotel/Agentur (mit Noten)   → Antworten · Ø Bewertung · Offene Punkte
 *   Gästebuch (ohne Noten)      → Glückwünsche · Fotos & Videos · Gäste
 *
 * Umgesetzt als Prioritätsliste statt als drei feste Zweige: jeder Kandidat steht genau einmal
 * drin, Duplikate fallen raus, die ersten drei gewinnen. Dadurch kann keine Kombination von
 * Fähigkeiten dieselbe Zahl zweimal zeigen — auch eine, die es heute noch nicht gibt.
 *
 * Rein (keine DB): die Seite zählt, diese Funktion entscheidet nur, was davon erscheint.
 */

import type { DashboardCapabilities, DashboardLabels } from '@/lib/sectors'

import { formatNumber } from './metrics'

export type HeroStatId = 'responses' | 'rating' | 'media' | 'open' | 'guests'

export type HeroStat = {
  id: HeroStatId
  label: string
  value: string
  /** Nur bei der Note gesetzt („/ 5,0") — sonst spricht die Zahl für sich. */
  unit?: string
  /** Zielbildschirm; eine Kennzahl ohne Anschlusshandlung bleibt Dekoration. */
  href: string
}

export type HeroStatInput = {
  responses: number
  media: number
  /** Beitragende Gast-Identitäten (guest_user_id), nicht Namen — siehe Übersicht. */
  guests: number
  openItems: number
  /** `null`, solange niemand bewertet hat — nicht 0. */
  averageRating: number | null
}

export function heroStats(
  input: HeroStatInput,
  labels: DashboardLabels,
  can: DashboardCapabilities,
): HeroStat[] {
  const byId: Record<HeroStatId, HeroStat> = {
    responses: {
      id: 'responses',
      label: labels.responses,
      value: formatNumber(input.responses),
      href: '/dashboard/feedback',
    },
    rating: {
      id: 'rating',
      label: 'Ø Bewertung',
      value: input.averageRating !== null ? formatNumber(input.averageRating, 1) : '—',
      unit: input.averageRating !== null ? '/ 5,0' : undefined,
      href: '/dashboard/reports',
    },
    media: {
      id: 'media',
      label: labels.media,
      value: formatNumber(input.media),
      href: '/dashboard/media',
    },
    open: {
      id: 'open',
      label: 'Offene Punkte',
      value: formatNumber(input.openItems),
      href: '/dashboard/feedback?state=open',
    },
    guests: {
      id: 'guests',
      label: 'Gäste',
      value: formatNumber(input.guests),
      href: '/dashboard/feedback',
    },
  }

  // Reihenfolge = Priorität. Die hinteren beiden sind Auffüller für den Fall, dass die
  // vorderen Kandidaten zusammenfallen; ohne sie stünden dort weniger als drei Zahlen.
  const priority: HeroStatId[] = [
    'responses',
    can.ratingEnabled ? 'rating' : 'media',
    can.serviceRecoveryEnabled ? 'open' : can.guestNameEnabled ? 'guests' : 'media',
    'media',
    'guests',
  ]

  const seen = new Set<HeroStatId>()
  const stats: HeroStat[] = []
  for (const id of priority) {
    if (seen.has(id)) continue
    seen.add(id)
    stats.push(byId[id])
    if (stats.length === 3) break
  }

  return stats
}
