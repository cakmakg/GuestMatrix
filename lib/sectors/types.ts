/**
 * Gemeinsamer Vertrag für alle Sektor-Module.
 *
 * Ein Sektor ist eine vom Betreiber entwickelte Code-Einheit unter `lib/sectors/<id>/`.
 * Diese Datei definiert die Typen und die modus-abhängigen (nicht sektor-spezifischen)
 * Konstanten; die sektor-spezifischen Inhalte (Kampagnentypen + Texte) liegen je Sektor
 * in seinem eigenen Ordner.
 */

// ─── Tupel + Basistypen (zentrale Aufzählung, für Zod-Enums wiederverwendbar) ──

// Hinweis: `agency` erscheint als Sektor-ID (dormanter Sektor `lib/sectors/agency/`) UND als
// Kampagnentyp-ID (aktiver tourism-Kampagnentyp seit Remodel 0016). Getrennte Namensräume
// (Sector vs. CampaignType) — kein Konflikt. Der Kampagnentyp `tour` wurde von 0016 zu `agency`.
export const SECTOR_TUPLE = ['tourism', 'real_estate', 'event', 'agency'] as const
export const CAMPAIGN_TYPE_TUPLE = ['agency', 'stay', 'property', 'wedding', 'trip'] as const
export const FLOW_MODE_TUPLE = ['gallery', 'feedback', 'guestbook'] as const

// Sichtbarkeitsachse eines Events, orthogonal zu flow_mode (0021). 'private' (Default) ist das
// bisherige geschlossene Modell; 'shared'/'moderated' öffnen den Gäste-Lesepfad — nur für
// flow_mode='guestbook' zulässig (events_visibility_check). Nach dem Anlegen unveränderlich
// (tenant_update_own_events, 0021).
export const EVENT_VISIBILITY_TUPLE = ['private', 'shared', 'moderated'] as const

// Unterrolle eines Tenants innerhalb eines Sektors (`tenants.business_type`). Sie partitioniert die
// Kampagnentypen des Sektors in Geschäftsmodelle und wird bei der Registrierung fest gewählt
// (unveränderlich). Aktiv: tourism → hotel|agency. Sektoren ohne business_type lassen die Spalte
// NULL. Namensraum getrennt von CampaignType (`agency` steht in beiden; `hotel`≠`stay`).
export const BUSINESS_TYPE_TUPLE = ['hotel', 'agency'] as const

export type Sector = (typeof SECTOR_TUPLE)[number]
export type CampaignType = (typeof CAMPAIGN_TYPE_TUPLE)[number]
export type FlowMode = (typeof FLOW_MODE_TUPLE)[number]
export type BusinessType = (typeof BUSINESS_TYPE_TUPLE)[number]
export type EventVisibility = (typeof EVENT_VISIBILITY_TUPLE)[number]

// ─── Fähigkeiten je Flow-Modus ────────────────────────────────────────────────

export type CampaignCapabilities = {
  mediaRequired: boolean
  galleryEnabled: boolean
  reciprocityEnabled: boolean
  ratingEnabled: boolean
  commentEnabled: boolean
  // Erfasst zusätzlich den Gastnamen (z. B. Gästebuch-Gruß). Nur im guestbook-Modus.
  guestNameEnabled: boolean
  // Service Recovery: ein Beitrag kann als bearbeitet markiert werden (`submissions.resolved_at`,
  // Migration 0020). Ein Beschwerde-Abarbeitungslauf — im Gästebuch gibt es nichts abzuarbeiten:
  // ein Glückwunsch ist kein offener Punkt.
  serviceRecoveryEnabled: boolean
  // Auswertungen über den Zeitraum (Berichte). Betriebs-/Marketingwerkzeug; ein Brautpaar wertet
  // seine Feier nicht aus.
  reportsEnabled: boolean
  // CSV-Export der Gästeantworten. Wie `reportsEnabled` ein Betriebswerkzeug.
  exportEnabled: boolean
}

export const FLOW_MODE_CAPABILITIES: Record<FlowMode, CampaignCapabilities> = {
  gallery: {
    mediaRequired: true,
    galleryEnabled: true,
    reciprocityEnabled: true,
    ratingEnabled: true,
    // Öffentliche Beschreibung/Caption zum Foto (für reziproke Gäste in der Galerie sichtbar).
    commentEnabled: true,
    guestNameEnabled: false,
    serviceRecoveryEnabled: true,
    reportsEnabled: true,
    exportEnabled: true,
  },
  feedback: {
    mediaRequired: false,
    galleryEnabled: false,
    reciprocityEnabled: false,
    ratingEnabled: true,
    commentEnabled: true,
    guestNameEnabled: false,
    serviceRecoveryEnabled: true,
    reportsEnabled: true,
    exportEnabled: true,
  },
  // Privates Gästebuch: Name + Gruß + optionale Medien, nur für den Veranstalter
  // sichtbar (keine geteilte Galerie, keine Reciprocity, kein Rating). Ebenso wenig
  // Service Recovery / Berichte / Export — das sind Betriebswerkzeuge ohne Adressaten
  // auf einer Feier.
  guestbook: {
    mediaRequired: false,
    galleryEnabled: false,
    reciprocityEnabled: false,
    ratingEnabled: false,
    commentEnabled: true,
    guestNameEnabled: true,
    serviceRecoveryEnabled: false,
    reportsEnabled: false,
    exportEnabled: false,
  },
}

// Modus-abhängige Texte (Sichtbarkeit vs. privates Feedback).
export const FLOW_MODE_LABELS: Record<FlowMode, { consentText: string; successText: string }> = {
  gallery: {
    consentText:
      'Ich stimme zu, dass meine Fotos/Videos und meine Beschreibung gespeichert und für ' +
      'alle Gäste sichtbar gemacht werden. Ich kann meine Einwilligung jederzeit widerrufen ' +
      'und meine Daten löschen lassen.',
    successText: 'Danke für deinen Beitrag!',
  },
  feedback: {
    consentText:
      'Ich stimme zu, dass mein Feedback (und ggf. Fotos/Videos) gespeichert und an den ' +
      'Veranstalter übermittelt wird. Ich kann meine Einwilligung jederzeit widerrufen und ' +
      'meine Daten löschen lassen.',
    successText: 'Danke für dein Feedback!',
  },
  guestbook: {
    consentText:
      'Ich stimme zu, dass mein Name, meine Nachricht und meine Fotos/Videos gespeichert und ' +
      'dem Veranstalter (Brautpaar) gezeigt werden. Ich kann meine Einwilligung jederzeit ' +
      'widerrufen und meine Daten löschen lassen.',
    successText: 'Danke für eure lieben Worte!',
  },
}

// Consent-Text für das Gästebuch, ZUSÄTZLICH nach `events.visibility` gestaffelt (0021, rechtlich
// nötig: wer „nur das Brautpaar sieht" zustimmt, darf nicht öffentlich erscheinen). `private`
// übernimmt wortgleich FLOW_MODE_LABELS.guestbook.consentText. Nur für flow_mode='guestbook'
// relevant — andere Modi bleiben bei FLOW_MODE_LABELS (siehe resolveConsentText).
export const GUESTBOOK_VISIBILITY_CONSENT_TEXT: Record<EventVisibility, string> = {
  private: FLOW_MODE_LABELS.guestbook.consentText,
  shared:
    'Ich stimme zu, dass mein Name, meine Nachricht und meine Fotos/Videos gespeichert und ' +
    'ALLEN Gästen dieser Feier gezeigt werden (nicht nur dem Brautpaar). Ich kann meine ' +
    'Einwilligung jederzeit widerrufen und meine Daten löschen lassen.',
  moderated:
    'Ich stimme zu, dass mein Name, meine Nachricht und meine Fotos/Videos gespeichert und ' +
    'nach Prüfung durch den Veranstalter allen Gästen dieser Feier gezeigt werden. Ich kann ' +
    'meine Einwilligung jederzeit widerrufen und meine Daten löschen lassen.',
}

// ─── Strukturiertes Feedback (Feedback-Anreicherung) ──────────────────────────

/**
 * Eine strukturierte Feedback-Frage. Zwei Werttypen: `rating` (Sterne 1–5, Wert `number`) und
 * `text` (freie Kurzantwort, Wert `string`, z. B. Hochzeit „drei Worte"). Der Katalog je
 * Kampagnentyp liegt im Sektor-Modul; die Antworten landen generisch in
 * `submissions.feedback_answers` unter `id`. `id` ist deshalb ein STABILER Schlüssel und darf nie
 * geändert werden (sonst verwaisen alte Antworten). Der Werttyp wird an ALLEN Ebenen erzwungen:
 * Zod (Form), Handler (`invalidAnswerTypes`) und DB (`validate_feedback_answers`, Migration 0019).
 *
 * Compliance: Alle Fragen sind OPTIONAL („anbieten, nicht erzwingen"). Es gibt KEIN
 * Rating-Gating — nirgends wird nach der Bewertung verzweigt, um zufriedene Gäste zu
 * externen Reviews zu leiten oder unzufriedene auszublenden.
 */
export type FeedbackQuestion = {
  id: string
  prompt: string
  type: 'rating' | 'text'
  // Nur bei type: 'text' — Maximallänge der freien Antwort in Zeichen. Die DB erzwingt sie erneut.
  maxLength?: number
}

// ─── Kampagnentyp + Sektor-Modul ──────────────────────────────────────────────

// Kampagnentyp-spezifische Texte (der Flow-Modus wählt aus, welche gerendert werden).
// namePrompt/namePlaceholder nur relevant, wenn der Modus guestNameEnabled ist (guestbook).
export type CampaignTypeLabels = {
  landingHeadline: string
  ratingPrompt: string
  commentPrompt: string
  commentPlaceholder: string
  namePrompt?: string
  namePlaceholder?: string
}

// Aufgelöste, flache Beschriftungen, die der Gäste-Flow konsumiert.
export type GuestFlowLabels = {
  landingHeadline: string
  consentText: string
  ratingPrompt: string
  commentPrompt: string
  commentPlaceholder: string
  namePrompt?: string
  namePlaceholder?: string
  successText: string
  // Strukturierte Zusatzfragen (leer, wenn der Kampagnentyp keine definiert — z. B. tour).
  questions: readonly FeedbackQuestion[]
}

export type CampaignTypeConfig = {
  sector: Sector
  label: string
  defaultFlowMode: FlowMode
  allowFlowModeChoice: boolean
  labels: CampaignTypeLabels
  // Optionaler Katalog strukturierter Feedback-Fragen. Fehlt → nur Gesamt-Rating/Kommentar
  // (leichter tour-Flow). Der DB-Speicher (feedback_answers) ist generisch; kein Sonderfall-Code.
  questions?: readonly FeedbackQuestion[]
  // Darf der Betreiber beim Anlegen die Sichtbarkeit wählen (private/shared/moderated, 0021)?
  // Fehlt/false → immer 'private' (resolveVisibility). Nur für guestbook-Kampagnentypen sinnvoll
  // (events_visibility_check erzwingt das DB-seitig).
  allowVisibilityChoice?: boolean
}

// ─── Betreiber-Dashboard: Benennung je Geschäftsmodell ────────────────────────

/**
 * Wie das Dashboard die Arbeitseinheit des Kunden nennt. Ein Hotel verwaltet „Aufenthalte",
 * eine Reiseagentur „Reisen" — dasselbe `events`-Objekt, andere Sprache.
 *
 * Diese Beschriftungen gehören in die Registry, NICHT in die Seiten: sonst entstünde genau der
 * `if (businessType === 'hotel')`-Sonderfall, den die Sektor-Architektur vermeiden soll. Ein neuer
 * Sektor bringt seine Benennung als Code mit; das Dashboard liest sie.
 */
export type DashboardLabels = {
  /** Plural — Navigation und Seitentitel. */
  experiences: string
  /** Singular — Fließtext und Leerzustände. */
  experience: string
  /** Kennzahl auf der Übersicht. */
  activeExperiences: string
  /** Plural der Gästebeiträge — Navigation, Seitentitel, Kennzahl („Glückwünsche"). */
  responses: string
  /** Singular eines Gästebeitrags — Zähler und Leerzustände („Glückwunsch"). */
  response: string
  /** Medien-Bibliothek („Fotos & Videos"). */
  media: string
}

/**
 * Was ein Sektor oder eine business_type an Benennung MITBRINGT — jedes Feld optional.
 *
 * Getrennt von `DashboardLabels` (dem aufgelösten, vollständigen Satz), damit ein Modul nur die
 * Wörter überschreibt, die bei ihm wirklich anders heißen. Ein Hotel verwaltet „Aufenthalte",
 * sammelt aber ganz normale „Gästeantworten" — es soll deshalb nicht gezwungen sein, den
 * Standardtext zu wiederholen (und ihn beim nächsten Umformulieren zu vergessen).
 */
export type DashboardLabelOverrides = Partial<DashboardLabels>

/**
 * Welche Panels das Betreiber-Dashboard für diesen Tenant überhaupt zeigen darf.
 *
 * Bewusst eine Teilmenge von `CampaignCapabilities` statt eines zweiten, parallel gepflegten
 * Typs: die Wahrheit steht weiterhin in FLOW_MODE_CAPABILITIES. `mediaRequired` und
 * `reciprocityEnabled` sind reine Gäste-Flow-Belange und fehlen hier deshalb.
 *
 * Ohne diese Ableitung zeigt das Dashboard einem Gästebuch-Tenant (Hochzeit) Kacheln, die es
 * nie füllen kann — „Ø Bewertung" bleibt „—", und der Link „kritische Bewertungen" öffnet
 * garantiert eine leere Liste. Das ist schlimmer als eine fehlende Kachel: es sieht aus wie
 * ein Datenfehler.
 */
export type DashboardCapabilities = Pick<
  CampaignCapabilities,
  | 'ratingEnabled'
  | 'galleryEnabled'
  | 'commentEnabled'
  | 'guestNameEnabled'
  | 'serviceRecoveryEnabled'
  | 'reportsEnabled'
  | 'exportEnabled'
>

// Eine business_type-Unterrolle bündelt die Kampagnentypen eines Geschäftsmodells. `campaignTypes`
// ist die Allowlist, die die DB-Grenze (current_tenant_allows_campaign, Migration 0017) spiegelt —
// aktuell je genau ein Typ (hotel→stay, agency→agency), das Array lässt aber mehrere zu.
export type BusinessTypeConfig = {
  label: string
  campaignTypes: CampaignType[]
  // Fehlt sie, greift die Benennung des Sektors, sonst der neutrale Standard.
  dashboardLabels?: DashboardLabelOverrides
}

/** Eine vom Betreiber entwickelte Sektor-Einheit (ein Ordner unter `lib/sectors/<id>/`). */
export type SectorModule = {
  id: Sector
  label: string
  campaignTypes: Partial<Record<CampaignType, CampaignTypeConfig>>
  // Optional: partitioniert die Kampagnentypen in Geschäftsmodelle (Tenant-Unterrolle). Fehlt sie,
  // hat der Sektor keine business_type (Spalte bleibt NULL) — z. B. die dormanten Sektoren.
  businessTypes?: Partial<Record<BusinessType, BusinessTypeConfig>>
  // Benennung für Sektoren ohne business_type (z. B. event). Eine business_type darf sie überschreiben.
  dashboardLabels?: DashboardLabelOverrides
}

export type SectorConfig = {
  label: string
  campaignTypes: CampaignType[]
  businessTypes?: Partial<Record<BusinessType, BusinessTypeConfig>>
  dashboardLabels?: DashboardLabelOverrides
}
