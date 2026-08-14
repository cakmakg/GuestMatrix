import type { SectorModule } from '../types'

/**
 * Sektor: Tourismus.
 * Kampagnentypen: Agentur/Reise (Galerie + Feedback-Katalog) · Hotel/Aufenthalt (Feedback).
 *
 * Remodel (0016): der frühere Kampagnentyp `tour` wurde zu `agency` — Repositionierung des
 * Beachheads von einzelnen Reiseleiter:innen auf Reiseagenturen. `agency` behält den gallery-Flow
 * (Foto/Video + Reciprocity + Galerie) UND trägt zusätzlich einen strukturierten Feedback-Katalog
 * (Reiseerlebnis + Agentur-Service) — kein neuer flow_mode, nur die vorhandene gallery+
 * feedback_answers-Mechanik kombiniert.
 *
 * Namenshinweis: `agency` ist hier ein KAMPAGNENTYP im tourism-Sektor. Der gleichnamige, weiterhin
 * DORMANTE Sektor `lib/sectors/agency/` (Kampagnentyp `trip`) ist davon unabhängig — Sektor- und
 * Kampagnentyp-Namensräume sind getrennt (Sector vs. CampaignType).
 */
export const tourism = {
  id: 'tourism',
  label: 'Tourismus',
  // Beide Geschäftsmodelle dieses Sektors führen einen Betrieb: Listen, Filter, Auswertungen.
  // Sie teilen deshalb EIN Thema — was hotel von agency unterscheidet, steht in der Benennung
  // (Aufenthalte vs. Reisen) und in den Fähigkeiten, nicht im Erscheinungsbild. Ausdrücklich
  // gesetzt, obwohl es dem Standard entspricht: die Registry soll die Absicht aussprechen.
  dashboardTheme: 'operator',
  // Unterrollen (tenants.business_type): Hotels machen Aufenthalts-Feedback (stay), Reiseagenturen
  // die Foto-Galerie + Agentur-Feedback (agency). Diese Allowlist spiegelt die DB-Sicherheitsgrenze
  // (current_tenant_allows_campaign, Migration 0017): hotel→stay, agency→agency.
  businessTypes: {
    hotel: {
      label: 'Hotel / Resort',
      campaignTypes: ['stay'],
      // Ein Hotel verwaltet Aufenthalte, keine „Kampagnen" — dieselbe events-Zeile, andere Sprache.
      dashboardLabels: {
        experiences: 'Aufenthalte',
        experience: 'Aufenthalt',
        activeExperiences: 'Aktive Aufenthalte',
      },
    },
    agency: {
      label: 'Reiseagentur',
      campaignTypes: ['agency'],
      dashboardLabels: {
        experiences: 'Reisen',
        experience: 'Reise',
        activeExperiences: 'Aktive Reisen',
      },
    },
  },
  campaignTypes: {
    agency: {
      sector: 'tourism',
      label: 'Agentur / Reise',
      defaultFlowMode: 'gallery',
      allowFlowModeChoice: false,
      labels: {
        landingHeadline: 'Teile deine Reisefotos und -videos mit allen Reisenden!',
        ratingPrompt: 'Wie war deine Reise?',
        commentPrompt: 'Dein Kommentar (optional)',
        commentPlaceholder: 'Was hat dir besonders gefallen?',
      },
      // Strukturierte Zusatzfragen für Agentur-Reisen — alle optional („anbieten, nicht erzwingen"),
      // gestapelt auf den gallery-Flow. Die id ist ein stabiler Speicherschlüssel (feedback_answers)
      // und darf nicht geändert werden; sie muss mit der Allowlist in validate_feedback_answers
      // (Migration 0016) übereinstimmen.
      questions: [
        { id: 'experience', prompt: 'Reiseerlebnis', type: 'rating' },
        { id: 'organization', prompt: 'Organisation & Ablauf', type: 'rating' },
        { id: 'service', prompt: 'Service & Beratung der Agentur', type: 'rating' },
        { id: 'value', prompt: 'Preis-Leistung', type: 'rating' },
      ],
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
