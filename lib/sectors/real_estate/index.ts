import type { SectorModule } from '../types'

/**
 * Sektor: Immobilien.
 * Kampagnentyp: Immobilie — Flow-Modus je Kampagne wählbar (Galerie oder Feedback).
 */
export const realEstate = {
  id: 'real_estate',
  label: 'Immobilien',
  campaignTypes: {
    property: {
      sector: 'real_estate',
      label: 'Immobilie',
      defaultFlowMode: 'feedback',
      allowFlowModeChoice: true,
      labels: {
        landingHeadline: 'Teile deine Eindrücke zu dieser Immobilie.',
        ratingPrompt: 'Wie war die Besichtigung?',
        commentPrompt: 'Deine Anmerkungen (optional)',
        commentPlaceholder: 'Was denkst du über diese Immobilie?',
      },
    },
  },
} satisfies SectorModule
