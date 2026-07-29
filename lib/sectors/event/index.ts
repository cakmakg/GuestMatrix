import type { SectorModule } from '../types'

/**
 * Sektor: Hochzeit / Event.
 * Kampagnentyp: Hochzeit/Event (privates Gästebuch — guestbook).
 * Gäste hinterlassen Name + Glückwunsch + Fotos/Videos; sichtbar nur für das Brautpaar.
 * Geteilte Galerie / Live-Fotowand folgt später (dann als gallery-Modus).
 */
export const event = {
  id: 'event',
  label: 'Hochzeit / Event',
  campaignTypes: {
    wedding: {
      sector: 'event',
      label: 'Hochzeit / Event',
      defaultFlowMode: 'guestbook',
      allowFlowModeChoice: false,
      labels: {
        landingHeadline: 'Hinterlasst dem Brautpaar eure Glückwünsche und schönsten Fotos!',
        ratingPrompt: 'Wie war die Feier für dich?',
        commentPrompt: 'Eure Glückwünsche',
        commentPlaceholder: 'Schreibt dem Brautpaar ein paar liebe Worte …',
        namePrompt: 'Euer Name',
        namePlaceholder: 'Von wem ist der Gruß?',
      },
    },
  },
} satisfies SectorModule
