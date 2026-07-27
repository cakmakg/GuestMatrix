import type { SectorModule } from '../types'

/**
 * Sektor: Hochzeit / Event.
 * Kampagnentyp: Hochzeit/Event (Galerie).
 */
export const event = {
  id: 'event',
  label: 'Hochzeit / Event',
  campaignTypes: {
    wedding: {
      sector: 'event',
      label: 'Hochzeit / Event',
      defaultFlowMode: 'gallery',
      allowFlowModeChoice: false,
      labels: {
        landingHeadline: 'Teilt eure schönsten Momente mit allen Gästen!',
        ratingPrompt: 'Wie war die Feier für dich?',
        commentPrompt: 'Dein Kommentar (optional)',
        commentPlaceholder: 'Was war dein schönster Moment?',
      },
    },
  },
} satisfies SectorModule
