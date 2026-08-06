import type { SectorModule } from '../types'

/**
 * Sektor: Reisebüro (Reiseagentur).
 * Kampagnentyp: Reise (Galerie) — Reisende teilen ihre Fotos/Videos, wie bei einer Tour.
 *
 * Dormant: als Code/Vorlage vorhanden (Muster wie `event`/`real_estate`), aber NICHT in
 * `lib/sectors/index.ts` registriert und per DB-CHECK (0006: `tenants.sector = 'tourism'`)
 * nicht speicherbar. Die Signup-Auswahl bietet ihn daher noch nicht an. Der Trigger-Allowlist
 * (0015) kennt ihn dennoch als gültige Sektor-ID (Schicht 1), der CHECK bleibt Schicht 2.
 * (Wieder-)Aktivierung: docs/extension-points.md.
 */
export const agency = {
  id: 'agency',
  label: 'Reisebüro',
  campaignTypes: {
    trip: {
      sector: 'agency',
      label: 'Reise',
      defaultFlowMode: 'gallery',
      allowFlowModeChoice: false,
      labels: {
        landingHeadline: 'Teile deine Reisefotos und -videos mit allen Reisenden!',
        ratingPrompt: 'Wie war deine Reise?',
        commentPrompt: 'Dein Kommentar (optional)',
        commentPlaceholder: 'Was war dein schönster Moment?',
      },
    },
  },
} satisfies SectorModule
