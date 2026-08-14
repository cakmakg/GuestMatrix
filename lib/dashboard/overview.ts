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

/**
 * Tage bis zur Feier — in KALENDERTAGEN, nicht in 24-Stunden-Blöcken.
 *
 * `events.date` ist ein reines Datum ohne Uhrzeit. Rechnete man mit Millisekunden, hinge das
 * Ergebnis an der Tageszeit des Aufrufs: am Abend vor der Feier käme „noch 0 Tage" heraus,
 * am Morgen „noch 1 Tag" — für dieselbe Feier. Deshalb beide Seiten auf lokale Mitternacht
 * normalisieren und erst dann zählen.
 *
 * `null`, wenn das Datum unlesbar ist — dann zeigt der Aufrufer lieber gar keinen Countdown.
 */
export function daysUntil(dateIso: string, now: number): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso)
  if (!match) return null

  const [, year, month, day] = match
  const target = new Date(Number(year), Number(month) - 1, Number(day))
  if (Number.isNaN(target.getTime())) return null

  const today = new Date(now)
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  return Math.round((target.getTime() - todayMidnight.getTime()) / 86_400_000)
}

/**
 * Der kleine Text über dem Kampagnennamen. Vor der Feier zählt er herunter, am Tag selbst sagt
 * er „heute", danach tritt er zurück und nennt nur noch die Art der Kampagne — ein Countdown
 * ins Negative wäre nach der Feier nur noch Lärm, und gerade DANN trudeln die Beiträge ein.
 */
export function countdownKicker(dateIso: string, now: number, typeLabel: string): string {
  const days = daysUntil(dateIso, now)
  if (days === null || days < 0) return typeLabel
  if (days === 0) return `${typeLabel} · heute`
  if (days === 1) return `${typeLabel} · noch 1 Tag`
  return `${typeLabel} · noch ${formatNumber(days)} Tage`
}

export type HeroStatId = 'responses' | 'rating' | 'media' | 'open' | 'guests' | 'photos' | 'videos'

/** „+3 heute" — oder nichts, wenn heute nichts dazukam. Eine „±0"-Zeile ist nur Rauschen. */
function todayDelta(count: number | undefined): string | undefined {
  return count !== undefined && count > 0 ? `+${count} heute` : undefined
}

/**
 * Fällt der Zeitstempel auf den heutigen KALENDERTAG (Ortszeit)?
 *
 * Nicht „in den letzten 24 Stunden": ein Beitrag von gestern 23:00 ist gestern, auch wenn er
 * zwei Stunden alt ist. Der Betreiber liest „heute" als Datum, nicht als Zeitfenster.
 */
export function isToday(iso: string | null, now: number): boolean {
  if (!iso) return false
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return false

  const today = new Date(now)
  return (
    then.getFullYear() === today.getFullYear() &&
    then.getMonth() === today.getMonth() &&
    then.getDate() === today.getDate()
  )
}

export type HeroStat = {
  id: HeroStatId
  label: string
  value: string
  /** Nur bei der Note gesetzt („/ 5,0") — sonst spricht die Zahl für sich. */
  unit?: string
  /**
   * Zuwachs von heute („+3 heute"). Fehlt, wo ein Tageszuwachs nichts aussagt: eine
   * Durchschnittsnote wächst nicht, und offene Punkte sollen nicht wie ein Erfolg aussehen.
   */
  delta?: string
  /** Zielbildschirm; eine Kennzahl ohne Anschlusshandlung bleibt Dekoration. */
  href: string
}

export type HeroStatInput = {
  responses: number
  media: number
  /** Fotos und Videos getrennt — im Sammel-Flow sind das zwei verschiedene Aussagen. */
  photos: number
  videos: number
  /** Beitragende Gast-Identitäten (guest_user_id), nicht Namen — siehe Übersicht. */
  guests: number
  openItems: number
  /** `null`, solange niemand bewertet hat — nicht 0. */
  averageRating: number | null
  /** Wieviel davon HEUTE dazukam. Fehlt → keine Zuwachszeile. */
  today?: { responses: number; photos: number; videos: number }
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
      delta: todayDelta(input.today?.responses),
      href: '/dashboard/feedback',
    },
    photos: {
      id: 'photos',
      label: 'Fotos',
      value: formatNumber(input.photos),
      delta: todayDelta(input.today?.photos),
      href: '/dashboard/media?kind=photo',
    },
    videos: {
      id: 'videos',
      label: 'Videos',
      value: formatNumber(input.videos),
      delta: todayDelta(input.today?.videos),
      href: '/dashboard/media?kind=video',
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

  // Reihenfolge = Priorität. Die hinteren sind Auffüller für den Fall, dass die vorderen
  // Kandidaten zusammenfallen; ohne sie stünden dort weniger als drei Zahlen.
  //
  // Im Sammel-Flow zählt, WAS zusammengekommen ist — Grüße, Fotos, Videos. Fotos und Videos
  // getrennt, weil ein Brautpaar sie unterschiedlich verwendet (drucken vs. ansehen) und die
  // Zusammenfassung zu „Medien" genau diese Unterscheidung verschluckt.
  const priority: HeroStatId[] = can.contributionCentric
    ? ['responses', 'photos', 'videos', 'media', 'guests']
    : [
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
