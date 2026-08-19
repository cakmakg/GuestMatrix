import { SIGNUP_OPTIONS, resolveDashboardCapabilities, type SignupOption } from '@/lib/sectors'

import type { IconName } from './icons'

/**
 * Die Marketing-Inhalte je Geschäftsart — abgeleitet aus der Registry, nicht daneben gepflegt.
 *
 * Warum abgeleitet: die Startseite verspricht in drei Bildern (Hero-Wechsler, Anlässe-Karten,
 * Fuß-Spalte) genau das, was ein Kunde bei der Registrierung auch wählen kann. Stünde die Liste
 * hier als Literal, würde die Seite in dem Moment lügen, in dem ein Sektor an- oder abgeschaltet
 * wird — sie bewürbe eine Geschäftsart, die die Registrierung nicht anbietet (oder verschwiege
 * eine, die sie anbietet). `SIGNUP_OPTIONS` gibt Zugehörigkeit UND Reihenfolge vor; diese Datei
 * steuert nur die Worte bei.
 *
 * Ein Eintrag ohne Text erscheint NICHT auf der Seite (die Seite bleibt heil). Damit das nicht
 * still passiert, prüft `tests/marketing.test.ts`, dass jede aktive Option einen Text hat.
 */

/**
 * Aussagen, die eine Fähigkeit behaupten. Der Schlüssel ist absichtlich der Fähigkeitsname
 * selbst: so gibt es keine Übersetzungstabelle, die auseinanderlaufen kann, und der Test ist
 * eine einzige Nachschlagung.
 *
 * Nur diese vier, weil nur sie je nach Flow-Modus FALSCH sein können — ein Gästebuch kennt
 * keine Bewertung und keine Galerie (`FLOW_MODE_CAPABILITIES`). Aussagen ohne Anspruch
 * („Foto", „Videobotschaften") tragen kein Feld: Medien sind in jedem Modus erlaubt.
 */
export type MarketingClaim =
  'ratingEnabled' | 'galleryEnabled' | 'commentEnabled' | 'serviceRecoveryEnabled'

export type MarketingChip = {
  icon: IconName
  label: string
  claim?: MarketingClaim
}

export type MarketingBullet = {
  label: string
  claim?: MarketingClaim
}

/** Die Produktattrappe: eine Kampagne dieser Geschäftsart, wie sie im Produkt aussähe. */
export type SectorCardContent = {
  title: string
  audience: string
  icon: IconName
  qrHint: string
  chips: readonly MarketingChip[]
  ctaLabel: string
  accent: 'red' | 'orange' | 'yellow'
}

export type UseCaseContent = {
  title: string
  tagline: string
  body: string
  bullets: readonly MarketingBullet[]
}

type SegmentContent = {
  /** Kurzform für Wechsler-Punkte und Fuß-Spalte („Hotels"). */
  navLabel: string
  card: SectorCardContent
  useCase: UseCaseContent
}

export type MarketingSegment = SegmentContent & {
  option: SignupOption
}

/**
 * Getastet auf den stabilen Formularwert aus `SIGNUP_OPTIONS` (`${sector}:${businessType ?? ''}`)
 * — derselbe Wert, den auch die Registrierung serverseitig auflöst. Ein Sektor ohne
 * business_type (z. B. `event`) hat den leeren zweiten Teil.
 */
const CONTENT: Partial<Record<string, SegmentContent>> = {
  'tourism:hotel': {
    navLabel: 'Hotels',
    card: {
      title: 'Hotel Adler · Gäste',
      audience: 'Für Hotels',
      icon: 'hotel',
      qrHint: 'Dein QR-Code',
      // Ein Aufenthalt läuft im Feedback-Modus: Bewertung und Kommentar tragen den Ablauf,
      // Foto und Video sind erlaubt, aber freiwillig. Deshalb KEINE Galerie und kein Album.
      chips: [
        { icon: 'camera', label: 'Foto' },
        { icon: 'star', label: 'Bewertung', claim: 'ratingEnabled' },
        { icon: 'video', label: 'Video' },
        { icon: 'message', label: 'Feedback', claim: 'commentEnabled' },
      ],
      ctaLabel: 'Erfahrung teilen',
      accent: 'red',
    },
    useCase: {
      title: 'Hotels',
      tagline: 'Gäste-Feedback + Bewertungen',
      body: 'Zum Check-out ein QR-Code an der Rezeption — echte Rückmeldungen, bevor der Gast das Zimmer verlässt.',
      bullets: [
        { label: 'Direktes Gäste-Feedback', claim: 'commentEnabled' },
        // Statt „Google & TripAdvisor Reviews" aus der Vorlage: es gibt keine Anbindung an
        // Bewertungsportale. Der echte Nutzen ist die Reihenfolge — erst intern, dann öffentlich.
        { label: 'Feedback vor der öffentlichen Bewertung', claim: 'ratingEnabled' },
        { label: 'Fotos für Social & Website' },
        { label: 'Beschwerden intern lösen', claim: 'serviceRecoveryEnabled' },
      ],
    },
  },

  'tourism:agency': {
    navLabel: 'Reisen',
    card: {
      title: 'Kreta 2026 · Nord Reisen',
      audience: 'Für Reiseagenturen',
      icon: 'globe',
      qrHint: 'Reisegruppen-QR',
      // „Story" aus der Vorlage ist ersetzt: das Produkt kennt Foto und Video, kein Story-Format.
      chips: [
        { icon: 'camera', label: 'Reisefoto' },
        { icon: 'star', label: 'Bewertung', claim: 'ratingEnabled' },
        { icon: 'video', label: 'Video' },
        { icon: 'album', label: 'Album', claim: 'galleryEnabled' },
      ],
      ctaLabel: 'Reisemoment teilen',
      accent: 'orange',
    },
    useCase: {
      title: 'Reiseagenturen',
      tagline: 'Reisefotos + UGC',
      body: 'Echte Inhalte direkt vom Ziel — Reisefotos, Videos und Bewertungen, nicht Monate später.',
      bullets: [
        { label: 'Reisefotos in Echtzeit' },
        { label: 'UGC für Instagram & Katalog' },
        { label: 'Bewertungen pro Reise', claim: 'ratingEnabled' },
        { label: 'Sammelalbum pro Gruppe', claim: 'galleryEnabled' },
      ],
    },
  },

  'event:': {
    navLabel: 'Hochzeiten',
    card: {
      title: 'Lena & Max · 15.06.26',
      audience: 'Für Hochzeiten & Events',
      icon: 'heart',
      qrHint: 'Digitales Gästebuch',
      // Kein Bewertungs-Chip: das Gästebuch hat `ratingEnabled: false`. Ein Brautpaar sammelt
      // Glückwünsche, es misst nicht die Feier.
      chips: [
        { icon: 'camera', label: 'Foto' },
        { icon: 'video', label: 'Videogruß' },
        { icon: 'message', label: 'Wunsch', claim: 'commentEnabled' },
        { icon: 'heart', label: 'Gästebuch' },
      ],
      ctaLabel: 'Glückwunsch senden',
      accent: 'yellow',
    },
    useCase: {
      title: 'Hochzeiten & Events',
      tagline: 'Digitales Gästebuch',
      body: 'Glückwünsche, Fotos und Videobotschaften — vom ersten Sekt bis zum letzten Tanz.',
      bullets: [
        { label: 'Digitales Gästebuch' },
        { label: 'Videobotschaften der Gäste' },
        // Die Vorlage warb hier mit „Ein Album für alle". Das Gästebuch ist geschlossen
        // (`allowVisibilityChoice: false`, Migration 0021): einen Bildschirm, auf dem Gäste die
        // Beiträge der anderen sehen, gibt es nicht. Die Geschlossenheit IST das Versprechen.
        { label: 'Nur das Brautpaar sieht die Beiträge' },
        // Statt „Dauerhaft archiviert": das Gegenteil ist zugesichert — ein Löschpfad.
        { label: 'Jederzeit löschbar' },
      ],
    },
  },
}

/**
 * Die aktiven Segmente in der Reihenfolge der Registrierung. Einziger Ableitungspunkt für
 * Hero-Wechsler, Anlässe und Fuß.
 */
export const MARKETING_SEGMENTS: readonly MarketingSegment[] = SIGNUP_OPTIONS.flatMap(
  (option): MarketingSegment[] => {
    const content = CONTENT[option.value]
    return content ? [{ option, ...content }] : []
  },
)

/**
 * Was die Software für dieses Segment tatsächlich kann. Bewusst über
 * `resolveDashboardCapabilities` und nicht über eine eigene Rechnung: das ist der vorhandene
 * Ableitungspunkt, der die Vereinigung über alle erlaubten Kampagnentypen und deren Flow-Modi
 * bildet. Der Name sagt „Dashboard", die Flags sind aber dieselben Fähigkeiten — hier zählt nur,
 * ob eine beworbene Fähigkeit überhaupt existiert.
 */
export function capabilitiesForSegment(segment: MarketingSegment): Record<MarketingClaim, boolean> {
  const capabilities = resolveDashboardCapabilities(
    segment.option.sector,
    segment.option.businessType,
  )
  return {
    ratingEnabled: capabilities.ratingEnabled,
    galleryEnabled: capabilities.galleryEnabled,
    commentEnabled: capabilities.commentEnabled,
    serviceRecoveryEnabled: capabilities.serviceRecoveryEnabled,
  }
}

/** Alle Ansprüche, die ein Segment in Karte und Anlass erhebt — Eingabe des Deckungstests. */
export function claimsOfSegment(segment: MarketingSegment): MarketingClaim[] {
  const fromChips = segment.card.chips.map((chip) => chip.claim)
  const fromBullets = segment.useCase.bullets.map((bullet) => bullet.claim)
  return [...fromChips, ...fromBullets].filter(
    (claim): claim is MarketingClaim => claim !== undefined,
  )
}
