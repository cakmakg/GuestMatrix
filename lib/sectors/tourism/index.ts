import type { SectorModule } from '../types'

/**
 * Sektor: Tourismus.
 * Kampagnentypen: Tour (Galerie) · Hotel/Aufenthalt (Feedback).
 */
export const tourism = {
  id: 'tourism',
  label: 'Tourismus',
  campaignTypes: {
    tour: {
      sector: 'tourism',
      label: 'Tour',
      defaultFlowMode: 'gallery',
      allowFlowModeChoice: false,
      labels: {
        landingHeadline: 'Teile deine Fotos und Videos mit allen Gästen!',
        ratingPrompt: 'Wie war die Tour für dich?',
        commentPrompt: 'Dein Kommentar (optional)',
        commentPlaceholder: 'Was hat dir besonders gefallen?',
      },
    },
    stay: {
      sector: 'tourism',
      label: 'Hotel / Aufenthalt',
      defaultFlowMode: 'feedback',
      allowFlowModeChoice: false,
      labels: {
        landingHeadline: 'Wie war dein Aufenthalt? Teile dein Feedback mit uns.',
        ratingPrompt: 'Wie bewertest du deinen Aufenthalt?',
        commentPrompt: 'Dein Kommentar (optional)',
        commentPlaceholder: 'Was hat dir gefallen? Was können wir verbessern?',
      },
      // Strukturierte Zusatzfragen für Aufenthalte — alle optional. Die id ist ein stabiler
      // Speicherschlüssel (feedback_answers) und darf nicht geändert werden.
      questions: [
        { id: 'cleanliness', prompt: 'Sauberkeit', type: 'rating' },
        { id: 'service', prompt: 'Personal & Service', type: 'rating' },
        { id: 'location', prompt: 'Lage', type: 'rating' },
        { id: 'value', prompt: 'Preis-Leistung', type: 'rating' },
      ],
    },
  },
} satisfies SectorModule
