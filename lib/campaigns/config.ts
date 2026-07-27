/**
 * Kampagnen-Registry — die einzige Quelle der Wahrheit für Sektoren,
 * Kampagnentypen und den daraus abgeleiteten Gäste-Flow.
 *
 * Erweiterung um einen neuen Sektor = hier einen Eintrag ergänzen (+ ggf. einen
 * neuen FlowMode) und die CHECK-Liste der Migration anpassen. UI, Endpunkte und
 * der Gäste-Flow leiten sich vollständig aus dieser Datei ab — kein Sektor ist
 * privilegiert oder Standard.
 *
 * Client- und serverseitig importierbar (keine Secrets, keine Server-Abhängigkeiten).
 */

// ─── Basistypen (aus Tupeln abgeleitet, für Zod wiederverwendbar) ─────────────

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

// ─── Beschriftungen ───────────────────────────────────────────────────────────

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

// Kampagnentyp-spezifische Texte (der Flow-Modus wählt aus, welche davon gerendert werden).
type CampaignTypeLabels = {
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

// ─── Kampagnentyp-Konfiguration ───────────────────────────────────────────────

export type CampaignTypeConfig = {
  sector: Sector
  label: string
  defaultFlowMode: FlowMode
  allowFlowModeChoice: boolean
  labels: CampaignTypeLabels
}

export const CAMPAIGN_TYPES: Record<CampaignType, CampaignTypeConfig> = {
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
  },
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
}

// ─── Sektor-Registry ──────────────────────────────────────────────────────────

export type SectorConfig = {
  label: string
  campaignTypes: CampaignType[]
}

export const SECTORS: Record<Sector, SectorConfig> = {
  tourism: { label: 'Tourismus', campaignTypes: ['tour', 'stay'] },
  real_estate: { label: 'Immobilien', campaignTypes: ['property'] },
  event: { label: 'Hochzeit / Event', campaignTypes: ['wedding'] },
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

export function getCampaignConfig(type: CampaignType): CampaignTypeConfig {
  return CAMPAIGN_TYPES[type]
}

export function campaignTypesForSector(sector: Sector): CampaignType[] {
  return SECTORS[sector].campaignTypes
}

export function isValidCampaignForSector(sector: Sector, type: CampaignType): boolean {
  return SECTORS[sector].campaignTypes.includes(type)
}

export function isFlowModeAllowed(type: CampaignType, mode: FlowMode): boolean {
  const config = CAMPAIGN_TYPES[type]
  return config.allowFlowModeChoice ? true : mode === config.defaultFlowMode
}

/** Löst den effektiven Flow-Modus auf: Wahl des Operators nur, wenn der Typ sie erlaubt. */
export function resolveFlowMode(type: CampaignType, chosen?: FlowMode | null): FlowMode {
  const config = CAMPAIGN_TYPES[type]
  if (config.allowFlowModeChoice && chosen) return chosen
  return config.defaultFlowMode
}

export function getCapabilities(mode: FlowMode): CampaignCapabilities {
  return FLOW_MODE_CAPABILITIES[mode]
}

/** Kombiniert typ- und modus-abhängige Texte zu einem flachen Objekt für den Gäste-Flow. */
export function resolveLabels(type: CampaignType, mode: FlowMode): GuestFlowLabels {
  const typeLabels = CAMPAIGN_TYPES[type].labels
  const modeLabels = FLOW_MODE_LABELS[mode]
  return {
    landingHeadline: typeLabels.landingHeadline,
    consentText: modeLabels.consentText,
    ratingPrompt: typeLabels.ratingPrompt,
    commentPrompt: typeLabels.commentPrompt,
    commentPlaceholder: typeLabels.commentPlaceholder,
    successText: modeLabels.successText,
  }
}

// ─── Narrowing für DB-Strings (text-Spalten kommen als string zurück) ─────────

export function isSector(value: string): value is Sector {
  return (SECTOR_TUPLE as readonly string[]).includes(value)
}

export function isCampaignType(value: string): value is CampaignType {
  return (CAMPAIGN_TYPE_TUPLE as readonly string[]).includes(value)
}

export function isFlowMode(value: string): value is FlowMode {
  return (FLOW_MODE_TUPLE as readonly string[]).includes(value)
}
