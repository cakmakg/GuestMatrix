/**
 * Sektor-Registry — aggregiert die aktiven Sektor-Module und stellt die öffentliche
 * API bereit (SECTORS, CAMPAIGN_TYPES + Helfer). Client- und serverseitig importierbar.
 *
 * Die Sektoren selbst werden vom Betreiber entwickelt und liegen je Sektor in einem
 * eigenen Ordner (`lib/sectors/<id>/`). Kein Sektor ist Standard.
 *
 * ── AKTIVER UMFANG (Retrenchment 0006 + Öffnung 0009 + Remodel 0016 + Event 0018) ─
 * Aktiv registriert sind der Sektor tourism mit agency (gallery + Feedback-Katalog) UND
 * stay (feedback) sowie der Sektor event mit wedding (guestbook). Migration 0009 hat den CHECK auf
 * flow_mode in (gallery, feedback) erweitert und dabei ATOMAR public_gallery_select um
 * is_gallery_event ergänzt (B1: Feedback-Kommentare gelangen nie in die Gäste-Galerie); Migration
 * 0016 hat den früheren Kampagnentyp `tour` zu `agency` umbenannt (campaign_type in (agency, stay)),
 * den gallery-Flow behalten und einen agency-Feedback-Katalog ergänzt; Migration 0018 hat den Sektor
 * event + wedding + flow_mode guestbook geöffnet (geschlossenes Gästebuch: Gäste sehen nur den
 * eigenen Gruß, alle nur das Brautpaar) und dabei denselben B1-Audit erneut abgesichert.
 * Weiterhin GESPERRT: der Sektor `lib/sectors/real_estate/` und der dormante Sektor
 * `lib/sectors/agency/` — als Code vorhanden (types.ts hält die Tupel bewusst breit),
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
  BusinessType,
  BusinessTypeConfig,
  CampaignCapabilities,
  CampaignType,
  CampaignTypeConfig,
  DashboardCapabilities,
  DashboardLabels,
  FeedbackQuestion,
  FlowMode,
  GuestFlowLabels,
  Sector,
  SectorConfig,
} from './types'
import { FLOW_MODE_CAPABILITIES, FLOW_MODE_LABELS, FLOW_MODE_TUPLE } from './types'
import { event } from './event'
import { tourism } from './tourism'

export * from './types'

// ─── Aggregierte Registries (nur aktive Einträge; Partial wegen Retrenchment) ──

export const SECTORS: Partial<Record<Sector, SectorConfig>> = {
  tourism: {
    label: tourism.label,
    campaignTypes: ['agency', 'stay'],
    businessTypes: tourism.businessTypes,
  },
  // event (Hochzeit/Event) seit 0018 aktiv: ein Kampagnentyp `wedding` (Flow-Modus guestbook).
  // Kein business_type (nicht-tourism → tenants.business_type bleibt NULL, tenants_business_type_check).
  event: {
    label: event.label,
    campaignTypes: ['wedding'],
    dashboardLabels: event.dashboardLabels,
  },
}

export const CAMPAIGN_TYPES: Partial<Record<CampaignType, CampaignTypeConfig>> = {
  agency: tourism.campaignTypes.agency,
  stay: tourism.campaignTypes.stay,
  wedding: event.campaignTypes.wedding,
}

// business_type-Registry, KEYED auf business_type (nicht auf Sektor) — spiegelt die DB-Grenze
// current_tenant_allows_campaign (0017), die ebenfalls nur die business_type kennt. Invariante:
// eine business_type-ID gehört genau EINEM Sektor (global eindeutig). `sector` ist mitgeführt, damit
// Aufrufer ohne Sektor-Kontext den Sektor auflösen können.
export const BUSINESS_TYPES: Partial<
  Record<BusinessType, BusinessTypeConfig & { sector: Sector }>
> = {
  hotel: { ...tourism.businessTypes.hotel, sector: 'tourism' },
  agency: { ...tourism.businessTypes.agency, sector: 'tourism' },
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

// ─── business_type (Tenant-Unterrolle) ─────────────────────────────────────────

export function businessTypesForSector(sector: Sector): BusinessType[] {
  return Object.keys(SECTORS[sector]?.businessTypes ?? {}) as BusinessType[]
}

export function getBusinessTypeConfig(
  type: BusinessType,
): (BusinessTypeConfig & { sector: Sector }) | undefined {
  return BUSINESS_TYPES[type]
}

/** Kampagnentypen, die eine business_type anlegen darf (leer für unbekannte). */
export function campaignTypesForBusinessType(type: BusinessType): CampaignType[] {
  return BUSINESS_TYPES[type]?.campaignTypes ?? []
}

export function isValidCampaignForBusinessType(
  type: BusinessType,
  campaign: CampaignType,
): boolean {
  return BUSINESS_TYPES[type]?.campaignTypes.includes(campaign) ?? false
}

/**
 * Erlaubte Kampagnentypen eines Tenants: hat er eine business_type (tourism), zählt deren Allowlist;
 * sonst (nicht-tourism, business_type NULL) die Kampagnentypen des Sektors. Einziger Ableitungspunkt
 * für UI + App-Validierung; die harte Grenze bleibt die RLS-WITH-CHECK (0017).
 */
export function allowedCampaignTypes(
  sector: Sector,
  businessType: BusinessType | null,
): CampaignType[] {
  return businessType ? campaignTypesForBusinessType(businessType) : campaignTypesForSector(sector)
}

// ─── Betreiber-Dashboard: Benennung ───────────────────────────────────────────

/**
 * Neutraler Rückfall, wenn weder business_type noch Sektor eine Benennung mitbringen.
 * „Kampagne" ist das Wort des Betreibers, nicht das des Kunden — deshalb nur Notnagel.
 */
export const DEFAULT_DASHBOARD_LABELS: DashboardLabels = {
  experiences: 'Kampagnen',
  experience: 'Kampagne',
  activeExperiences: 'Aktive Kampagnen',
}

/**
 * Wie das Dashboard dieses Tenants seine Arbeitseinheit nennt. Reihenfolge: business_type
 * (feinste Auflösung) → Sektor → neutraler Standard. Einziger Ableitungspunkt; die Seiten
 * verzweigen NICHT selbst über die Geschäftsart.
 */
export function resolveDashboardLabels(
  sector: string | null | undefined,
  businessType: string | null | undefined,
): DashboardLabels {
  if (businessType && isBusinessType(businessType)) {
    const fromBusinessType = BUSINESS_TYPES[businessType]?.dashboardLabels
    if (fromBusinessType) return fromBusinessType
  }

  if (sector && isSector(sector)) {
    const fromSector = SECTORS[sector]?.dashboardLabels
    if (fromSector) return fromSector
  }

  return DEFAULT_DASHBOARD_LABELS
}

// ─── Betreiber-Dashboard: Panels ──────────────────────────────────────────────

/**
 * Fällt zurück, wenn der Sektor unbekannt ist (defekte/zukünftige tenants-Zeile).
 *
 * Bewusst alles `true`: eine unbekannte Geschäftsart soll KEINE Panels verstecken. Das Ausblenden
 * ist eine reine Darstellungsentscheidung — welche Daten ein Tenant sehen darf, entscheidet
 * ausschließlich die RLS. Ein Fehlgriff hier darf also höchstens eine leere Kachel zeigen,
 * niemals Daten verbergen, die jemand braucht.
 */
export const DEFAULT_DASHBOARD_CAPABILITIES: DashboardCapabilities = {
  ratingEnabled: true,
  galleryEnabled: true,
  commentEnabled: true,
  guestNameEnabled: true,
}

/** Die Flow-Modi, die ein Kampagnentyp annehmen kann (heute je genau einer). */
export function flowModesForCampaignType(type: CampaignType): FlowMode[] {
  const config = CAMPAIGN_TYPES[type]
  if (!config) return []
  return config.allowFlowModeChoice ? [...FLOW_MODE_TUPLE] : [config.defaultFlowMode]
}

/**
 * Was das Dashboard dieses Tenants zeigen kann — die VEREINIGUNG über alle Kampagnentypen, die
 * er anlegen darf, und deren Flow-Modi.
 *
 * Vereinigung (ODER), nicht Schnittmenge: kann auch nur eine seiner Kampagnen bewertet werden,
 * gehört die Bewertungs-Kachel ins Dashboard — sonst verschwände sie, sobald ein Tenant einen
 * zweiten Kampagnentyp bekommt.
 *
 * Zweiter Ableitungspunkt neben `resolveDashboardLabels`, nach demselben Muster: die Seiten
 * verzweigen NICHT selbst über Sektor oder Geschäftsart.
 */
export function resolveDashboardCapabilities(
  sector: string | null | undefined,
  businessType: string | null | undefined,
): DashboardCapabilities {
  if (!sector || !isSector(sector)) return DEFAULT_DASHBOARD_CAPABILITIES

  const resolvedBusinessType = businessType && isBusinessType(businessType) ? businessType : null
  const types = allowedCampaignTypes(sector, resolvedBusinessType)

  // Ein Tenant ohne erlaubte Kampagnentypen (deaktivierter Sektor) bekommt den Standard —
  // dieselbe Haltung wie beim unbekannten Sektor: nichts verstecken.
  if (types.length === 0) return DEFAULT_DASHBOARD_CAPABILITIES

  const union: DashboardCapabilities = {
    ratingEnabled: false,
    galleryEnabled: false,
    commentEnabled: false,
    guestNameEnabled: false,
  }

  for (const type of types) {
    for (const mode of flowModesForCampaignType(type)) {
      const capabilities = getCapabilities(mode)
      union.ratingEnabled ||= capabilities.ratingEnabled
      union.galleryEnabled ||= capabilities.galleryEnabled
      union.commentEnabled ||= capabilities.commentEnabled
      union.guestNameEnabled ||= capabilities.guestNameEnabled
    }
  }

  return union
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
export function unknownAnswerKeys(
  type: CampaignType,
  answers: Record<string, number | string>,
): string[] {
  const allowed = new Set(getFeedbackQuestions(type).map((q) => q.id))
  return Object.keys(answers).filter((key) => !allowed.has(key))
}

/**
 * Liefert die Antwort-Schlüssel, deren WERT-Typ nicht zum Fragentyp passt (rating → number,
 * text → string). Ergänzt unknownAnswerKeys (Zugehörigkeit); zusammen bilden sie die App-seitige
 * Prüfung, die DB (validate_feedback_answers) bleibt die letzte Verteidigungslinie. Unbekannte
 * Schlüssel ignoriert diese Funktion (das prüft unknownAnswerKeys). Leeres Array = alle Typen passen.
 */
export function invalidAnswerTypes(
  type: CampaignType,
  answers: Record<string, number | string>,
): string[] {
  const kinds = new Map(getFeedbackQuestions(type).map((q) => [q.id, q.type] as const))
  return Object.keys(answers).filter((key) => {
    const kind = kinds.get(key)
    if (!kind) return false
    return kind === 'text' ? typeof answers[key] !== 'string' : typeof answers[key] !== 'number'
  })
}

// ─── Narrowing für DB-Strings (text-Spalten kommen als string zurück) ─────────

export function isSector(value: string): value is Sector {
  return value in SECTORS
}

export function isCampaignType(value: string): value is CampaignType {
  return value in CAMPAIGN_TYPES
}

export function isBusinessType(value: string): value is BusinessType {
  return value in BUSINESS_TYPES
}

export function isFlowMode(value: string): value is FlowMode {
  return (FLOW_MODE_TUPLE as readonly string[]).includes(value)
}

// ─── Signup-Auswahl (registry-getrieben, sektor-transparent) ───────────────────
// Der Kunde sieht eine FLACHE Liste von Geschäftsarten — das Wort „Sektor" erscheint nicht. Jede
// Option kodiert (sector, business_type). Nur AKTIVE Kombinationen erscheinen: je registriertem
// Sektor eine Option pro business_type; ein Sektor ohne business_types liefert eine Option mit
// business_type=null. Werden Hochzeit/Immobilien aktiviert, tauchen sie hier automatisch auf.

export type SignupOption = {
  value: string // stabiler Formularwert `${sector}:${businessType ?? ''}`
  label: string
  sector: Sector
  businessType: BusinessType | null
}

export const SIGNUP_OPTIONS: SignupOption[] = Object.entries(SECTORS).flatMap(
  ([sectorId, config]): SignupOption[] => {
    if (!config || !isSector(sectorId)) return []
    const btEntries = Object.entries(config.businessTypes ?? {})
    if (btEntries.length === 0) {
      return [{ value: `${sectorId}:`, label: config.label, sector: sectorId, businessType: null }]
    }
    return btEntries.flatMap(([bt, btConfig]): SignupOption[] =>
      btConfig && isBusinessType(bt)
        ? [
            {
              value: `${sectorId}:${bt}`,
              label: btConfig.label,
              sector: sectorId,
              businessType: bt,
            },
          ]
        : [],
    )
  },
)

/** Server-seitige Autorität: übersetzt den Formularwert in (sector, business_type). */
export function getSignupOption(value: string): SignupOption | undefined {
  return SIGNUP_OPTIONS.find((option) => option.value === value)
}

export function isSignupChoice(value: string): boolean {
  return SIGNUP_OPTIONS.some((option) => option.value === value)
}
