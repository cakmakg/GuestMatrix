/**
 * Gemeinsamer Vertrag für alle Sektor-Module.
 *
 * Ein Sektor ist eine vom Betreiber entwickelte Code-Einheit unter `lib/sectors/<id>/`.
 * Diese Datei definiert die Typen und die modus-abhängigen (nicht sektor-spezifischen)
 * Konstanten; die sektor-spezifischen Inhalte (Kampagnentypen + Texte) liegen je Sektor
 * in seinem eigenen Ordner.
 */

// ─── Tupel + Basistypen (zentrale Aufzählung, für Zod-Enums wiederverwendbar) ──

export const SECTOR_TUPLE = ['tourism', 'real_estate', 'event'] as const
export const CAMPAIGN_TYPE_TUPLE = ['tour', 'stay', 'property', 'wedding'] as const
export const FLOW_MODE_TUPLE = ['gallery', 'feedback'] as const

export type Sector = (typeof SECTOR_TUPLE)[number]
export type CampaignType = (typeof CAMPAIGN_TYPE_TUPLE)[number]
export type FlowMode = (typeof FLOW_MODE_TUPLE)[number]

// ─── Fähigkeiten je Flow-Modus ────────────────────────────────────────────────

export type CampaignCapabilities = {
  mediaRequired: boolean
  galleryEnabled: boolean
  reciprocityEnabled: boolean
  ratingEnabled: boolean
  commentEnabled: boolean
}

export const FLOW_MODE_CAPABILITIES: Record<FlowMode, CampaignCapabilities> = {
  gallery: {
    mediaRequired: true,
    galleryEnabled: true,
    reciprocityEnabled: true,
    ratingEnabled: true,
    commentEnabled: false,
  },
  feedback: {
    mediaRequired: false,
    galleryEnabled: false,
    reciprocityEnabled: false,
    ratingEnabled: true,
    commentEnabled: true,
  },
}

// Modus-abhängige Texte (Sichtbarkeit vs. privates Feedback).
export const FLOW_MODE_LABELS: Record<FlowMode, { consentText: string; successText: string }> = {
  gallery: {
    consentText:
      'Ich stimme zu, dass meine Fotos/Videos gespeichert und für alle Gäste sichtbar ' +
      'gemacht werden. Ich kann meine Einwilligung jederzeit widerrufen und meine Daten ' +
      'löschen lassen.',
    successText: 'Danke für deinen Beitrag!',
  },
  feedback: {
    consentText:
      'Ich stimme zu, dass mein Feedback (und ggf. Fotos/Videos) gespeichert und an den ' +
      'Veranstalter übermittelt wird. Ich kann meine Einwilligung jederzeit widerrufen und ' +
      'meine Daten löschen lassen.',
    successText: 'Danke für dein Feedback!',
  },
}

// ─── Kampagnentyp + Sektor-Modul ──────────────────────────────────────────────

// Kampagnentyp-spezifische Texte (der Flow-Modus wählt aus, welche gerendert werden).
export type CampaignTypeLabels = {
  landingHeadline: string
  ratingPrompt: string
  commentPrompt: string
  commentPlaceholder: string
}

// Aufgelöste, flache Beschriftungen, die der Gäste-Flow konsumiert.
export type GuestFlowLabels = {
  landingHeadline: string
  consentText: string
  ratingPrompt: string
  commentPrompt: string
  commentPlaceholder: string
  successText: string
}

export type CampaignTypeConfig = {
  sector: Sector
  label: string
  defaultFlowMode: FlowMode
  allowFlowModeChoice: boolean
  labels: CampaignTypeLabels
}

/** Eine vom Betreiber entwickelte Sektor-Einheit (ein Ordner unter `lib/sectors/<id>/`). */
export type SectorModule = {
  id: Sector
  label: string
  campaignTypes: Partial<Record<CampaignType, CampaignTypeConfig>>
}

export type SectorConfig = {
  label: string
  campaignTypes: CampaignType[]
}
