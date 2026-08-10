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

// Unterrolle eines Tenants innerhalb eines Sektors (`tenants.business_type`). Sie partitioniert die
// Kampagnentypen des Sektors in Geschäftsmodelle und wird bei der Registrierung fest gewählt
// (unveränderlich). Aktiv: tourism → hotel|agency. Sektoren ohne business_type lassen die Spalte
// NULL. Namensraum getrennt von CampaignType (`agency` steht in beiden; `hotel`≠`stay`).
export const BUSINESS_TYPE_TUPLE = ['hotel', 'agency'] as const

export type Sector = (typeof SECTOR_TUPLE)[number]
export type CampaignType = (typeof CAMPAIGN_TYPE_TUPLE)[number]
export type FlowMode = (typeof FLOW_MODE_TUPLE)[number]
export type BusinessType = (typeof BUSINESS_TYPE_TUPLE)[number]

// ─── Fähigkeiten je Flow-Modus ────────────────────────────────────────────────

export type CampaignCapabilities = {
  mediaRequired: boolean
  galleryEnabled: boolean
  reciprocityEnabled: boolean
  ratingEnabled: boolean
  commentEnabled: boolean
  // Erfasst zusätzlich den Gastnamen (z. B. Gästebuch-Gruß). Nur im guestbook-Modus.
  guestNameEnabled: boolean
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
  },
  feedback: {
    mediaRequired: false,
    galleryEnabled: false,
    reciprocityEnabled: false,
    ratingEnabled: true,
    commentEnabled: true,
    guestNameEnabled: false,
  },
  // Privates Gästebuch: Name + Gruß + optionale Medien, nur für den Veranstalter
  // sichtbar (keine geteilte Galerie, keine Reciprocity, kein Rating).
  guestbook: {
    mediaRequired: false,
    galleryEnabled: false,
    reciprocityEnabled: false,
    ratingEnabled: false,
    commentEnabled: true,
    guestNameEnabled: true,
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
}

// Eine business_type-Unterrolle bündelt die Kampagnentypen eines Geschäftsmodells. `campaignTypes`
// ist die Allowlist, die die DB-Grenze (current_tenant_allows_campaign, Migration 0017) spiegelt —
// aktuell je genau ein Typ (hotel→stay, agency→agency), das Array lässt aber mehrere zu.
export type BusinessTypeConfig = {
  label: string
  campaignTypes: CampaignType[]
}

/** Eine vom Betreiber entwickelte Sektor-Einheit (ein Ordner unter `lib/sectors/<id>/`). */
export type SectorModule = {
  id: Sector
  label: string
  campaignTypes: Partial<Record<CampaignType, CampaignTypeConfig>>
  // Optional: partitioniert die Kampagnentypen in Geschäftsmodelle (Tenant-Unterrolle). Fehlt sie,
  // hat der Sektor keine business_type (Spalte bleibt NULL) — z. B. die dormanten Sektoren.
  businessTypes?: Partial<Record<BusinessType, BusinessTypeConfig>>
}

export type SectorConfig = {
  label: string
  campaignTypes: CampaignType[]
  businessTypes?: Partial<Record<BusinessType, BusinessTypeConfig>>
}
