/**
 * Sektor-Registry — aggregiert die aktiven Sektor-Module und stellt die öffentliche
 * API bereit (SECTORS, CAMPAIGN_TYPES + Helfer). Client- und serverseitig importierbar.
 *
 * Die Sektoren selbst werden vom Betreiber entwickelt und liegen je Sektor in einem
 * eigenen Ordner (`lib/sectors/<id>/`). Kein Sektor ist Standard.
 *
 * ── AKTIVER UMFANG (Retrenchment 0006 + Öffnung 0009 + Remodel 0016) ────────────
 * Aktiv registriert ist der Sektor tourism mit agency (gallery + Feedback-Katalog) UND
 * stay (feedback). Migration 0009 hat den CHECK auf flow_mode in (gallery, feedback) erweitert
 * und dabei ATOMAR public_gallery_select um is_gallery_event ergänzt (B1: Feedback-Kommentare
 * gelangen nie in die Gäste-Galerie); Migration 0016 hat den früheren Kampagnentyp `tour` zu
 * `agency` umbenannt (campaign_type in (agency, stay)), den gallery-Flow behalten und einen
 * agency-Feedback-Katalog ergänzt. Der Sektor bleibt 'tourism' (kein Sektorwechsel).
 * Weiterhin GESPERRT: die Sektoren `lib/sectors/event/` und `lib/sectors/real_estate/`
 * sowie der Modus guestbook — als Code vorhanden (types.ts hält die Tupel bewusst breit),
 * aber hier NICHT importiert/registriert und per DB-CHECK nicht speicherbar.
 *
 * ── Einen deaktivierten Sektor/Modus (wieder) aktivieren ────────────────────────
 * Vollständige Anleitung: docs/extension-points.md. Kurz:
 *   1. CHECK in einer neuen Migration erweitern (tenants.sector / events.campaign_type /
 *      events.flow_mode).
 *   2. Modul unten importieren und in SECTORS + CAMPAIGN_TYPES eintragen (Vorlagen:
 *      `lib/sectors/event/`, `lib/sectors/real_estate/`).
 *   3. Bei guest-sichtbaren Modi public_gallery_select / public_select_events auditieren.
 * UI, Endpunkte und Gäste-Flow leiten sich vollständig hieraus ab — kein Sonderfall-Code.
 */

import type {
  CampaignCapabilities,
  CampaignType,
  CampaignTypeConfig,
  FeedbackQuestion,
  FlowMode,
  GuestFlowLabels,
  Sector,
  SectorConfig,
} from './types'
import { FLOW_MODE_CAPABILITIES, FLOW_MODE_LABELS, FLOW_MODE_TUPLE } from './types'
import { tourism } from './tourism'

export * from './types'

// ─── Aggregierte Registries (nur aktive Einträge; Partial wegen Retrenchment) ──

export const SECTORS: Partial<Record<Sector, SectorConfig>> = {
  tourism: { label: tourism.label, campaignTypes: ['agency', 'stay'] },
}

export const CAMPAIGN_TYPES: Partial<Record<CampaignType, CampaignTypeConfig>> = {
  agency: tourism.campaignTypes.agency,
  stay: tourism.campaignTypes.stay,
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

// Hinweis (Retrenchment): Da nur aktive Typen/Sektoren registriert sind, liefern die
// Registry-Zugriffe `undefined` für deaktivierte Werte. Die Helfer sind entsprechend
// null-sicher; der DB-CHECK stellt sicher, dass sie zur Laufzeit nur aktive Werte sehen.

export function getCampaignConfig(type: CampaignType): CampaignTypeConfig | undefined {
  return CAMPAIGN_TYPES[type]
}

export function campaignTypesForSector(sector: Sector): CampaignType[] {
  return SECTORS[sector]?.campaignTypes ?? []
}

export function isValidCampaignForSector(sector: Sector, type: CampaignType): boolean {
  return SECTORS[sector]?.campaignTypes.includes(type) ?? false
}

export function isFlowModeAllowed(type: CampaignType, mode: FlowMode): boolean {
  const config = CAMPAIGN_TYPES[type]
  if (!config) return false
  return config.allowFlowModeChoice ? true : mode === config.defaultFlowMode
}

/**
 * Löst den effektiven Flow-Modus auf — der einzige Dispatch-Punkt für den Gäste-Flow.
 * ── Erweiterungspunkt ──: Neue Modi/Sektoren werden über die Registry oben aktiviert
 * (Anleitung: docs/extension-points.md); diese Funktion bleibt der Verteiler.
 * Wahl des Operators nur, wenn der Typ sie erlaubt. Deaktivierter/unbekannter Typ →
 * `gallery` (der einzige aktive Modus).
 */
export function resolveFlowMode(type: CampaignType, chosen?: FlowMode | null): FlowMode {
  const config = CAMPAIGN_TYPES[type]
  if (!config) return 'gallery'
  if (config.allowFlowModeChoice && chosen) return chosen
  return config.defaultFlowMode
}

export function getCapabilities(mode: FlowMode): CampaignCapabilities {
  return FLOW_MODE_CAPABILITIES[mode]
}

/** Kombiniert typ- und modus-abhängige Texte zu einem flachen Objekt für den Gäste-Flow. */
export function resolveLabels(type: CampaignType, mode: FlowMode): GuestFlowLabels {
  const typeLabels = CAMPAIGN_TYPES[type]?.labels
  const modeLabels = FLOW_MODE_LABELS[mode]
  return {
    landingHeadline: typeLabels?.landingHeadline ?? '',
    consentText: modeLabels.consentText,
    ratingPrompt: typeLabels?.ratingPrompt ?? '',
    commentPrompt: typeLabels?.commentPrompt ?? '',
    commentPlaceholder: typeLabels?.commentPlaceholder ?? '',
    namePrompt: typeLabels?.namePrompt,
    namePlaceholder: typeLabels?.namePlaceholder,
    successText: modeLabels.successText,
    questions: getFeedbackQuestions(type),
  }
}

/**
 * Strukturierter Feedback-Katalog eines Kampagnentyps (leer, wenn keiner definiert ist — z. B.
 * tour). Server-seitige Quelle der Wahrheit für die Antwort-Validierung; dem Client wird nicht
 * vertraut.
 */
export function getFeedbackQuestions(type: CampaignType): readonly FeedbackQuestion[] {
  return CAMPAIGN_TYPES[type]?.questions ?? []
}

/**
 * Liefert die Antwort-Schlüssel, die NICHT im Katalog des Kampagnentyps stehen. Leeres Array =
 * alle Schlüssel gültig; der Handler wirft bei nicht-leerem Ergebnis ValidationError. Die
 * Wertebereiche (1–5) prüft bereits das Zod-Schema — hier geht es allein um die Zugehörigkeit.
 */
export function unknownAnswerKeys(type: CampaignType, answers: Record<string, number>): string[] {
  const allowed = new Set(getFeedbackQuestions(type).map((q) => q.id))
  return Object.keys(answers).filter((key) => !allowed.has(key))
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
