/**
 * Sektor-Registry — aggregiert die einzelnen Sektor-Module und stellt die öffentliche
 * API bereit (SECTORS, CAMPAIGN_TYPES + Helfer). Client- und serverseitig importierbar.
 *
 * Die Sektoren selbst werden vom Betreiber entwickelt und liegen je Sektor in einem
 * eigenen Ordner (`lib/sectors/<id>/`). Kein Sektor ist Standard.
 *
 * ── Einen neuen Sektor hinzufügen ──────────────────────────────────────────────
 *   1. `lib/sectors/<id>/index.ts` anlegen (`export const <name> = {...} satisfies SectorModule`).
 *   2. Modul unten importieren, in SECTORS + CAMPAIGN_TYPES eintragen.
 *   3. `SECTOR_TUPLE` / `CAMPAIGN_TYPE_TUPLE` in `types.ts` um die neuen Werte ergänzen.
 *   4. CHECK-Wert in einer Migration ergänzen (tenants.sector bzw. events.campaign_type).
 * UI, Endpunkte und Gäste-Flow leiten sich vollständig hieraus ab — kein Sonderfall-Code.
 */

import type {
  CampaignCapabilities,
  CampaignType,
  CampaignTypeConfig,
  FlowMode,
  GuestFlowLabels,
  Sector,
  SectorConfig,
} from './types'
import { FLOW_MODE_CAPABILITIES, FLOW_MODE_LABELS, FLOW_MODE_TUPLE } from './types'
import { event } from './event'
import { realEstate } from './real_estate'
import { tourism } from './tourism'

export * from './types'

// ─── Aggregierte Registries ───────────────────────────────────────────────────

export const SECTORS: Record<Sector, SectorConfig> = {
  tourism: { label: tourism.label, campaignTypes: ['tour', 'stay'] },
  real_estate: { label: realEstate.label, campaignTypes: ['property'] },
  event: { label: event.label, campaignTypes: ['wedding'] },
}

export const CAMPAIGN_TYPES: Record<CampaignType, CampaignTypeConfig> = {
  tour: tourism.campaignTypes.tour,
  stay: tourism.campaignTypes.stay,
  property: realEstate.campaignTypes.property,
  wedding: event.campaignTypes.wedding,
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
    namePrompt: typeLabels.namePrompt,
    namePlaceholder: typeLabels.namePlaceholder,
    successText: modeLabels.successText,
  }
}

// ─── Narrowing für DB-Strings (text-Spalten kommen als string zurück) ─────────

export function isSector(value: string): value is Sector {
  return value in SECTORS
}

export function isCampaignType(value: string): value is CampaignType {
  return value in CAMPAIGN_TYPES
}

export function isFlowMode(value: string): value is FlowMode {
  return (FLOW_MODE_TUPLE as readonly string[]).includes(value)
}
