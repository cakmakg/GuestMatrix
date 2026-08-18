import { describe, expect, it } from 'vitest'

import {
  BUSINESS_TYPES,
  CAMPAIGN_TYPES,
  DASHBOARD_THEME_TUPLE,
  DEFAULT_DASHBOARD_CAPABILITIES,
  DEFAULT_DASHBOARD_LABELS,
  DEFAULT_DASHBOARD_THEME,
  SECTORS,
  SIGNUP_OPTIONS,
  flowModesForCampaignType,
  resolveDashboardCapabilities,
  resolveDashboardLabels,
  resolveDashboardTheme,
  resolveGuestTheme,
  allowedCampaignTypes,
  businessTypesForSector,
  campaignTypesForBusinessType,
  campaignTypesForSector,
  getBusinessTypeConfig,
  getCampaignConfig,
  getCapabilities,
  getFeedbackQuestions,
  getSignupOption,
  invalidAnswerTypes,
  isBusinessType,
  isCampaignType,
  isFlowMode,
  isFlowModeAllowed,
  isSector,
  isSignupChoice,
  isEventVisibility,
  isValidCampaignForBusinessType,
  isValidCampaignForSector,
  resolveConsentText,
  resolveFlowMode,
  resolveLabels,
  resolveVisibility,
  unknownAnswerKeys,
} from '@/lib/sectors'
import { event } from '@/lib/sectors/event'
import { tourism } from '@/lib/sectors/tourism'

// Aktiver Umfang (0006 Retrenchment + 0009 Öffnung + 0016 Remodel + 0018 Event): Sektor tourism mit
// agency (gallery + Feedback-Katalog) UND stay (feedback) SOWIE Sektor event mit wedding (guestbook).
// Der frühere Kampagnentyp `tour` wurde von 0016 zu `agency` umbenannt und behält den gallery-Flow;
// 0018 hat event/wedding/guestbook geöffnet. Weiterhin GESPERRT: real_estate und der dormante Sektor
// agency (nicht der aktive Kampagnentyp agency) — als Code vorhanden (types.ts hält die Tupel breit),
// aber nicht registriert und per DB-CHECK nicht speicherbar. Diese Tests fixieren die aktive
// Registry. Siehe docs/extension-points.md.

describe('active registry: tourism (agency+stay) + event (wedding)', () => {
  it('registers exactly the tourism and event sectors', () => {
    expect(Object.keys(SECTORS)).toEqual(['tourism', 'event'])
    expect(SECTORS.tourism?.label).toBe(tourism.label)
    expect(SECTORS.tourism?.campaignTypes).toEqual(['agency', 'stay'])
    expect(SECTORS.event?.label).toBe(event.label)
    expect(SECTORS.event?.campaignTypes).toEqual(['wedding'])
  })

  it('registers exactly the agency, stay and wedding campaign types', () => {
    expect(Object.keys(CAMPAIGN_TYPES)).toEqual(['agency', 'stay', 'wedding'])
    expect(campaignTypesForSector('tourism')).toEqual(['agency', 'stay'])
    expect(campaignTypesForSector('event')).toEqual(['wedding'])
  })

  it('event carries no business_type (non-tourism → tenants.business_type stays NULL)', () => {
    expect(SECTORS.event?.businessTypes).toBeUndefined()
    // allowedCampaignTypes fällt für business_type=null auf die Sektor-Typen zurück.
    expect(allowedCampaignTypes('event', null)).toEqual(['wedding'])
  })

  it('agency is a gallery campaign with no operator flow-mode choice', () => {
    const config = getCampaignConfig('agency')
    expect(config?.sector).toBe('tourism')
    expect(config?.defaultFlowMode).toBe('gallery')
    expect(config?.allowFlowModeChoice).toBe(false)
  })

  it('stay is a feedback campaign with no operator flow-mode choice', () => {
    const config = getCampaignConfig('stay')
    expect(config?.sector).toBe('tourism')
    expect(config?.defaultFlowMode).toBe('feedback')
    expect(config?.allowFlowModeChoice).toBe(false)
  })

  it('wedding is a guestbook campaign with no operator flow-mode choice', () => {
    const config = getCampaignConfig('wedding')
    expect(config?.sector).toBe('event')
    expect(config?.defaultFlowMode).toBe('guestbook')
    expect(config?.allowFlowModeChoice).toBe(false)
  })
})

describe('deactivated sectors / campaign types / modes stay rejected', () => {
  it('tourism and event are recognised sectors; real_estate + dormant agency are not', () => {
    expect(isSector('tourism')).toBe(true)
    expect(isSector('event')).toBe(true)
    // `agency` ist ein aktiver Kampagnentyp, aber der GLEICHNAMIGE Sektor bleibt dormant.
    for (const s of ['real_estate', 'agency', 'retail']) {
      expect(isSector(s)).toBe(false)
    }
  })

  it('agency, stay and wedding are recognised; the renamed tour and dormant types are not', () => {
    expect(isCampaignType('agency')).toBe(true)
    expect(isCampaignType('stay')).toBe(true)
    expect(isCampaignType('wedding')).toBe(true)
    // `tour` wurde von 0016 zu `agency` umbenannt und ist kein Kampagnentyp mehr.
    // `property` (real_estate) und `trip` (dormanter agency-Sektor) bleiben nicht registriert.
    for (const t of ['tour', 'property', 'trip']) {
      expect(isCampaignType(t)).toBe(false)
    }
  })

  it('campaignTypesForSector returns empty for unregistered sectors', () => {
    expect(campaignTypesForSector('real_estate')).toEqual([])
    expect(campaignTypesForSector('agency')).toEqual([])
  })

  it('getCampaignConfig returns undefined for still-deactivated types', () => {
    expect(getCampaignConfig('property')).toBeUndefined()
    expect(getCampaignConfig('trip')).toBeUndefined()
  })

  it('isValidCampaignForSector accepts the active sector/campaign pairs only', () => {
    expect(isValidCampaignForSector('tourism', 'agency')).toBe(true)
    expect(isValidCampaignForSector('tourism', 'stay')).toBe(true)
    expect(isValidCampaignForSector('event', 'wedding')).toBe(true)
    // Kreuz-Zuordnungen bleiben ungültig (Registry pinnt campaign_type an den Sektor).
    expect(isValidCampaignForSector('tourism', 'wedding')).toBe(false)
    expect(isValidCampaignForSector('event', 'agency')).toBe(false)
  })
})

describe('flow-mode resolution: agency→gallery, stay→feedback, wedding→guestbook', () => {
  it('agency always resolves to gallery, ignoring any chosen mode', () => {
    expect(resolveFlowMode('agency')).toBe('gallery')
    expect(resolveFlowMode('agency', 'feedback')).toBe('gallery')
    expect(resolveFlowMode('agency', 'guestbook')).toBe('gallery')
  })

  it('stay always resolves to feedback, ignoring any chosen mode', () => {
    expect(resolveFlowMode('stay')).toBe('feedback')
    expect(resolveFlowMode('stay', 'gallery')).toBe('feedback')
  })

  it('wedding always resolves to guestbook, ignoring any chosen mode', () => {
    expect(resolveFlowMode('wedding')).toBe('guestbook')
    expect(resolveFlowMode('wedding', 'gallery')).toBe('guestbook')
  })

  it('deactivated campaign types fall back to gallery', () => {
    expect(resolveFlowMode('property', 'feedback')).toBe('gallery')
    expect(resolveFlowMode('trip')).toBe('gallery')
  })

  it('isFlowModeAllowed matches each campaign default only', () => {
    expect(isFlowModeAllowed('agency', 'gallery')).toBe(true)
    expect(isFlowModeAllowed('agency', 'feedback')).toBe(false)
    expect(isFlowModeAllowed('stay', 'feedback')).toBe(true)
    expect(isFlowModeAllowed('stay', 'gallery')).toBe(false)
    expect(isFlowModeAllowed('wedding', 'guestbook')).toBe(true)
    expect(isFlowModeAllowed('wedding', 'gallery')).toBe(false)
  })
})

describe('active flow labels + capabilities (gallery + feedback)', () => {
  it('gallery requires media and enables gallery + reciprocity + comment', () => {
    const caps = getCapabilities('gallery')
    expect(caps.mediaRequired).toBe(true)
    expect(caps.galleryEnabled).toBe(true)
    expect(caps.reciprocityEnabled).toBe(true)
    // Öffentliche Foto-Beschreibung/Caption ist aktiv.
    expect(caps.commentEnabled).toBe(true)
  })

  it('feedback has no gallery/reciprocity but enables rating + comment', () => {
    const caps = getCapabilities('feedback')
    expect(caps.mediaRequired).toBe(false)
    expect(caps.galleryEnabled).toBe(false)
    expect(caps.reciprocityEnabled).toBe(false)
    expect(caps.ratingEnabled).toBe(true)
    expect(caps.commentEnabled).toBe(true)
  })

  it('resolveLabels combines the agency headline with gallery consent/success text', () => {
    const labels = resolveLabels('agency', 'gallery')
    expect(labels.landingHeadline).toBe(getCampaignConfig('agency')?.labels.landingHeadline)
    expect(labels.consentText).toContain('sichtbar')
    expect(labels.successText).toBeTruthy()
  })

  it('resolveLabels combines the stay headline with feedback consent/success text', () => {
    const labels = resolveLabels('stay', 'feedback')
    expect(labels.landingHeadline).toBe(getCampaignConfig('stay')?.labels.landingHeadline)
    expect(labels.consentText).toContain('Feedback')
    expect(labels.successText).toContain('Feedback')
  })
})

describe('structured feedback catalog (agency on gallery + stay on feedback)', () => {
  it('stay exposes a non-empty rating catalog with unique, stable ids', () => {
    const questions = getFeedbackQuestions('stay')
    expect(questions.length).toBeGreaterThan(0)
    expect(questions.every((q) => q.type === 'rating')).toBe(true)
    const ids = questions.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual(['cleanliness', 'service', 'location', 'value'])
  })

  it('agency exposes its own rating catalog stacked on the gallery flow', () => {
    const questions = getFeedbackQuestions('agency')
    expect(questions.length).toBeGreaterThan(0)
    expect(questions.every((q) => q.type === 'rating')).toBe(true)
    const ids = questions.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
    // Muss mit der Allowlist in validate_feedback_answers (Migration 0016) übereinstimmen.
    expect(ids).toEqual(['experience', 'organization', 'service', 'value'])
  })

  it('resolveLabels carries the agency catalog on gallery and the stay catalog on feedback', () => {
    expect(resolveLabels('agency', 'gallery').questions).toEqual(getFeedbackQuestions('agency'))
    expect(resolveLabels('stay', 'feedback').questions).toEqual(getFeedbackQuestions('stay'))
  })

  it('unknownAnswerKeys accepts each catalog and rejects everything else', () => {
    expect(unknownAnswerKeys('agency', { experience: 5, value: 3 })).toEqual([])
    expect(unknownAnswerKeys('agency', { experience: 5, cleanliness: 3 })).toEqual(['cleanliness'])
    expect(unknownAnswerKeys('stay', { cleanliness: 5, value: 3 })).toEqual([])
    expect(unknownAnswerKeys('stay', { cleanliness: 5, bogus: 3 })).toEqual(['bogus'])
    expect(unknownAnswerKeys('agency', {})).toEqual([])
  })
})

describe('wedding fun prompt: optional text feedback question (0019)', () => {
  it('wedding exposes a single optional text question with a stable id + maxLength', () => {
    const questions = getFeedbackQuestions('wedding')
    expect(questions).toHaveLength(1)
    const q = questions[0]
    expect(q?.id).toBe('three_words')
    expect(q?.type).toBe('text')
    expect(q?.maxLength).toBe(60)
  })

  it('resolveLabels carries the wedding text catalog on the guestbook mode', () => {
    expect(resolveLabels('wedding', 'guestbook').questions).toEqual(getFeedbackQuestions('wedding'))
  })

  it('unknownAnswerKeys accepts three_words and rejects everything else for wedding', () => {
    expect(unknownAnswerKeys('wedding', { three_words: 'schön laut emotional' })).toEqual([])
    expect(unknownAnswerKeys('wedding', { bogus: 'x' })).toEqual(['bogus'])
  })

  it('invalidAnswerTypes enforces the value type per question kind (text→string, rating→number)', () => {
    // wedding.three_words is a text question → string ok, a number is a type mismatch.
    expect(invalidAnswerTypes('wedding', { three_words: 'drei worte' })).toEqual([])
    expect(invalidAnswerTypes('wedding', { three_words: 5 })).toEqual(['three_words'])
    // stay/agency are rating questions → number ok, a string is a type mismatch (regression guard).
    expect(invalidAnswerTypes('stay', { cleanliness: 4 })).toEqual([])
    expect(invalidAnswerTypes('stay', { cleanliness: 'sauber' })).toEqual(['cleanliness'])
    expect(invalidAnswerTypes('agency', { experience: 5 })).toEqual([])
    // Unknown keys are ignored here — that is unknownAnswerKeys' job.
    expect(invalidAnswerTypes('wedding', { bogus: 5 })).toEqual([])
  })
})

describe('business_type sub-role (tourism → hotel|agency)', () => {
  it('registers hotel + agency, each mapped to exactly one campaign type', () => {
    expect(Object.keys(BUSINESS_TYPES).sort()).toEqual(['agency', 'hotel'])
    expect(businessTypesForSector('tourism').sort()).toEqual(['agency', 'hotel'])
    expect(campaignTypesForBusinessType('hotel')).toEqual(['stay'])
    expect(campaignTypesForBusinessType('agency')).toEqual(['agency'])
  })

  it('mirrors the DB mapping: hotel↔stay, agency↔agency; nothing crosses over', () => {
    expect(isValidCampaignForBusinessType('hotel', 'stay')).toBe(true)
    expect(isValidCampaignForBusinessType('hotel', 'agency')).toBe(false)
    expect(isValidCampaignForBusinessType('agency', 'agency')).toBe(true)
    expect(isValidCampaignForBusinessType('agency', 'stay')).toBe(false)
  })

  it('business type carries its sector and label', () => {
    expect(getBusinessTypeConfig('hotel')?.sector).toBe('tourism')
    expect(getBusinessTypeConfig('agency')?.sector).toBe('tourism')
    expect(getBusinessTypeConfig('hotel')?.label).toBe(tourism.businessTypes?.hotel?.label)
  })

  it('isBusinessType narrows only hotel/agency', () => {
    expect(isBusinessType('hotel')).toBe(true)
    expect(isBusinessType('agency')).toBe(true)
    for (const v of ['stay', 'tourism', 'wedding', 'nonsense']) {
      expect(isBusinessType(v)).toBe(false)
    }
  })

  it('allowedCampaignTypes filters by business type, falls back to sector when null', () => {
    expect(allowedCampaignTypes('tourism', 'hotel')).toEqual(['stay'])
    expect(allowedCampaignTypes('tourism', 'agency')).toEqual(['agency'])
    // Null business type (future non-tourism tenant) → sector campaign types (no business gate).
    expect(allowedCampaignTypes('tourism', null)).toEqual(campaignTypesForSector('tourism'))
  })
})

describe('signup options (flat business list, registry-driven)', () => {
  it('offers exactly the active (sector, business_type) combinations', () => {
    expect(SIGNUP_OPTIONS.map((o) => o.value).sort()).toEqual([
      'event:',
      'tourism:agency',
      'tourism:hotel',
    ])
  })

  it('each option maps to the correct sector + business type + label', () => {
    const hotel = getSignupOption('tourism:hotel')
    expect(hotel?.sector).toBe('tourism')
    expect(hotel?.businessType).toBe('hotel')
    expect(hotel?.label).toBe(tourism.businessTypes?.hotel?.label)
    const agency = getSignupOption('tourism:agency')
    expect(agency?.sector).toBe('tourism')
    expect(agency?.businessType).toBe('agency')
    // event: sektor-transparente Option ohne business_type (business_type bleibt NULL).
    const wedding = getSignupOption('event:')
    expect(wedding?.sector).toBe('event')
    expect(wedding?.businessType).toBeNull()
    expect(wedding?.label).toBe(event.label)
  })

  it('isSignupChoice accepts only offered values; rejects raw sectors and garbage', () => {
    expect(isSignupChoice('tourism:hotel')).toBe(true)
    expect(isSignupChoice('tourism:agency')).toBe(true)
    expect(isSignupChoice('event:')).toBe(true)
    // `tourism` ohne business_type ist ungültig; `event:wedding` ist ungültig (wedding ist ein
    // campaign_type, keine business_type); `real_estate:` bleibt gesperrt.
    for (const v of ['tourism', 'tourism:', 'event:wedding', 'real_estate:', 'hackerman']) {
      expect(isSignupChoice(v)).toBe(false)
    }
    expect(getSignupOption('real_estate:')).toBeUndefined()
  })
})

describe('guestbook is active for event/wedding (0018)', () => {
  it('gallery/feedback/guestbook are active flow-mode types; unknown strings are rejected', () => {
    expect(isFlowMode('gallery')).toBe(true)
    expect(isFlowMode('feedback')).toBe(true)
    expect(isFlowMode('guestbook')).toBe(true)
    expect(isFlowMode('none')).toBe(false)
  })

  it('wedding drives the guestbook mode, which requires the guest name', () => {
    expect(resolveFlowMode('wedding')).toBe('guestbook')
    expect(getCapabilities('guestbook').guestNameEnabled).toBe(true)
  })

  // Seit 2026-08-17 fragt JEDER Modus nach dem Namen — im Gästebuch als Pflicht, in gallery und
  // feedback freiwillig. Vorher konnte ein Betrieb einer Beschwerde niemanden zuordnen.
  it('asks for the guest name in every flow mode', () => {
    for (const mode of ['gallery', 'feedback', 'guestbook'] as const) {
      expect(getCapabilities(mode).guestNameEnabled).toBe(true)
    }
  })

  // Der Name ist personenbezogen: sammeln darf man ihn nur, wenn die Einwilligung ihn NENNT.
  // Diese Prüfung ist die Erinnerung daran, dass beides zusammengehört.
  it('names the guest name in the consent text of every mode that collects it', () => {
    for (const mode of ['gallery', 'feedback', 'guestbook'] as const) {
      expect(getCapabilities(mode).guestNameEnabled).toBe(true)
      expect(resolveConsentText(mode, 'private')).toMatch(/Name/)
    }
  })

  // In der Galerie ist die Trennung entscheidend: Foto und Beschreibung sehen ALLE Gäste, der
  // Name nur der Veranstalter. Der Text muss diese Grenze aussprechen.
  it('promises the gallery guest that only the operator sees the name', () => {
    const text = resolveConsentText('gallery', 'private')
    expect(text).toMatch(/nur dem Veranstalter/)
    expect(text).toMatch(/nicht den anderen Gästen/)
  })
})

// Die Dashboard-Benennung ist der Ersatz für `if (businessType === 'hotel')`-Sonderfälle.
// Bricht die Auflösung, spricht das Dashboard wieder Betreiber-Sprache („Kampagnen").
describe('dashboard labels resolve from the registry', () => {
  it('gives each tourism business type its own vocabulary', () => {
    expect(resolveDashboardLabels('tourism', 'hotel').experiences).toBe('Aufenthalte')
    expect(resolveDashboardLabels('tourism', 'agency').experiences).toBe('Reisen')
  })

  it('prefers the business type over the sector', () => {
    const hotel = resolveDashboardLabels('tourism', 'hotel')
    const bare = resolveDashboardLabels('tourism', null)
    expect(hotel.experiences).not.toBe(bare.experiences)
  })

  it('falls back to the sector when there is no business type', () => {
    // event hat keine business_type (Spalte bleibt NULL) — die Benennung hängt am Sektor.
    expect(resolveDashboardLabels('event', null).experiences).toBe('Feiern')
  })

  it('falls back to the neutral default for unknown or missing input', () => {
    expect(resolveDashboardLabels(null, null)).toEqual(DEFAULT_DASHBOARD_LABELS)
    expect(resolveDashboardLabels('real_estate', null)).toEqual(DEFAULT_DASHBOARD_LABELS)
    expect(resolveDashboardLabels('nonsense', 'nonsense')).toEqual(DEFAULT_DASHBOARD_LABELS)
  })

  it('resolves the appearance from the registry, finest match wins whole', () => {
    // Das Gästebuch blättert in Erinnerungen — es bekommt das Album-Thema aus lib/sectors/event.
    expect(resolveDashboardTheme('event', null)).toBe('album')
    // Der Betriebspfad bleibt beim erprobten Standardsatz.
    // Beide Geschäftsmodelle des Betriebspfads teilen EIN Thema — was sie unterscheidet, steht
    // in der Benennung und in den Fähigkeiten, nicht im Erscheinungsbild.
    expect(resolveDashboardTheme('tourism', 'hotel')).toBe('operator')
    expect(resolveDashboardTheme('tourism', 'agency')).toBe('operator')
  })

  it('falls back to the neutral theme for unknown, deactivated or missing input', () => {
    // Wie bei den Panels: ein unbekannter Sektor bekommt das Erprobte, nicht das Schönste.
    expect(resolveDashboardTheme(null, null)).toBe(DEFAULT_DASHBOARD_THEME)
    expect(resolveDashboardTheme('real_estate', null)).toBe(DEFAULT_DASHBOARD_THEME)
    expect(resolveDashboardTheme('nonsense', 'nonsense')).toBe(DEFAULT_DASHBOARD_THEME)
  })

  it('only ever resolves to a declared theme — a token block exists for each', () => {
    const cases = [
      resolveDashboardTheme('event', null),
      resolveDashboardTheme('tourism', 'hotel'),
      resolveDashboardTheme('tourism', 'agency'),
      resolveDashboardTheme(null, null),
    ]
    for (const theme of cases) {
      expect(DASHBOARD_THEME_TUPLE).toContain(theme)
    }
  })

  it('resolves the guest appearance from the campaign type — same axis, other input', () => {
    // Der Gast eines Gästebuchs sieht die Feier-Dichte, der Gast eines Betriebs die Betriebs-Dichte.
    expect(resolveGuestTheme('wedding')).toBe('album')
    expect(resolveGuestTheme('agency')).toBe('operator')
    expect(resolveGuestTheme('stay')).toBe('operator')
  })

  it('guest appearance agrees with the dashboard of the same tenant', () => {
    // Der Punkt der Achse: Panel und QR-Seite dürfen nicht wie zwei Produkte aussehen. Der Gast
    // kennt nur den Kampagnentyp, das Dashboard nur Sektor + Geschäftsart — dasselbe Ergebnis.
    expect(resolveGuestTheme('wedding')).toBe(resolveDashboardTheme('event', null))
    expect(resolveGuestTheme('agency')).toBe(resolveDashboardTheme('tourism', 'agency'))
    expect(resolveGuestTheme('stay')).toBe(resolveDashboardTheme('tourism', 'hotel'))
  })

  it('guest appearance falls back to the neutral theme for unknown or missing input', () => {
    // Eine öffentliche Seite darf an einem unbekannten Wert nicht scheitern: der Rückfall ist das
    // erprobte Thema, nicht das schönste (wie bei resolveDashboardTheme).
    expect(resolveGuestTheme(null)).toBe(DEFAULT_DASHBOARD_THEME)
    expect(resolveGuestTheme(undefined)).toBe(DEFAULT_DASHBOARD_THEME)
    expect(resolveGuestTheme('')).toBe(DEFAULT_DASHBOARD_THEME)
    expect(resolveGuestTheme('nonsense')).toBe(DEFAULT_DASHBOARD_THEME)
    // Deaktivierter (dormanter) Kampagnentyp — als Code vorhanden, nicht registriert.
    expect(resolveGuestTheme('property')).toBe(DEFAULT_DASHBOARD_THEME)
    expect(DASHBOARD_THEME_TUPLE).toContain(resolveGuestTheme('nonsense'))
  })

  it('never returns an empty string — every field is renderable', () => {
    const cases = [
      resolveDashboardLabels('tourism', 'hotel'),
      resolveDashboardLabels('tourism', 'agency'),
      resolveDashboardLabels('event', null),
      resolveDashboardLabels(null, null),
    ]
    for (const labels of cases) {
      expect(labels.experiences.length).toBeGreaterThan(0)
      expect(labels.experience.length).toBeGreaterThan(0)
      expect(labels.activeExperiences.length).toBeGreaterThan(0)
    }
  })

  it('every active business type ships its own labels', () => {
    for (const [id, config] of Object.entries(BUSINESS_TYPES)) {
      expect(config?.dashboardLabels, `${id} has no dashboardLabels`).toBeDefined()
    }
  })
})

describe('flowModesForCampaignType', () => {
  it('returns exactly the default mode while no type offers a choice', () => {
    expect(flowModesForCampaignType('agency')).toEqual(['gallery'])
    expect(flowModesForCampaignType('stay')).toEqual(['feedback'])
    expect(flowModesForCampaignType('wedding')).toEqual(['guestbook'])
  })

  it('returns nothing for a dormant type', () => {
    expect(flowModesForCampaignType('property')).toEqual([])
  })
})

describe('resolveDashboardCapabilities', () => {
  it('gives a hotel the rating panels', () => {
    const can = resolveDashboardCapabilities('tourism', 'hotel')
    expect(can.ratingEnabled).toBe(true)
    expect(can.commentEnabled).toBe(true)
    // Aufenthalts-Feedback ist privat — es gibt keine Gäste-Galerie.
    expect(can.galleryEnabled).toBe(false)
    // Freiwilliger Name (seit 2026-08-17): ohne ihn kann ein Hotel einer Beschwerde nicht nachgehen.
    expect(can.guestNameEnabled).toBe(true)
  })

  it('gives an agency the gallery panels', () => {
    const can = resolveDashboardCapabilities('tourism', 'agency')
    expect(can.galleryEnabled).toBe(true)
    expect(can.ratingEnabled).toBe(true)
  })

  // Der Kern: das Gästebuch kennt weder Noten noch eine Galerie — der Absender bleibt.
  it('denies rating and gallery for a wedding tenant but keeps the guest name', () => {
    const can = resolveDashboardCapabilities('event', null)
    expect(can.ratingEnabled).toBe(false)
    expect(can.galleryEnabled).toBe(false)
    expect(can.guestNameEnabled).toBe(true)
    expect(can.commentEnabled).toBe(true)
  })

  it('unions across campaign types instead of intersecting them', () => {
    // Ein Tenant ohne business_type im tourism-Sektor darf agency (gallery) UND stay (feedback):
    // die Galerie-Kachel muss bleiben, obwohl stay sie nicht mitbringt.
    const can = resolveDashboardCapabilities('tourism', null)
    expect(can.galleryEnabled).toBe(true)
    expect(can.ratingEnabled).toBe(true)
  })

  it('hides nothing when the sector is unknown or dormant', () => {
    expect(resolveDashboardCapabilities(null, null)).toEqual(DEFAULT_DASHBOARD_CAPABILITIES)
    expect(resolveDashboardCapabilities('nonsense', 'nonsense')).toEqual(
      DEFAULT_DASHBOARD_CAPABILITIES,
    )
    expect(resolveDashboardCapabilities('real_estate', null)).toEqual(
      DEFAULT_DASHBOARD_CAPABILITIES,
    )
  })

  it('stays consistent with the flow-mode capabilities it is derived from', () => {
    expect(resolveDashboardCapabilities('event', null).ratingEnabled).toBe(
      getCapabilities('guestbook').ratingEnabled,
    )
  })
})

describe('dashboard labels are layered, not all-or-nothing', () => {
  it('a hotel keeps its own experience words and inherits the neutral rest', () => {
    const labels = resolveDashboardLabels('tourism', 'hotel')
    expect(labels.experiences).toBe('Aufenthalte')
    // Ein Hotel sammelt gewöhnliche Gästeantworten — es muss den Standardtext nicht wiederholen.
    expect(labels.responses).toBe(DEFAULT_DASHBOARD_LABELS.responses)
    expect(labels.media).toBe(DEFAULT_DASHBOARD_LABELS.media)
  })

  it('a wedding tenant renames the guest contributions', () => {
    const labels = resolveDashboardLabels('event', null)
    expect(labels.experiences).toBe('Feiern')
    expect(labels.responses).toBe('Glückwünsche')
    expect(labels.response).toBe('Glückwunsch')
    expect(labels.media).toBe('Fotos & Videos')
  })

  it('every field stays renderable for every active combination', () => {
    const cases = [
      resolveDashboardLabels('tourism', 'hotel'),
      resolveDashboardLabels('tourism', 'agency'),
      resolveDashboardLabels('event', null),
      resolveDashboardLabels(null, null),
      resolveDashboardLabels('nonsense', 'nonsense'),
    ]
    for (const labels of cases) {
      for (const [field, value] of Object.entries(labels)) {
        expect(typeof value, `${field} is not a string`).toBe('string')
        expect(value.length, `${field} is empty`).toBeGreaterThan(0)
      }
    }
  })
})

describe('event visibility (0021, Dilim B): private/shared/moderated axis, wedding only', () => {
  // Die Achse ist in der DB fertig (0021), wird aber NOCH NICHT angeboten: der Bildschirm, auf
  // dem ein Gast fremde Beiträge sieht, ist Dilim C und zurückgestellt. Solange er fehlt, würde
  // `shared`/`moderated` im Einwilligungstext etwas versprechen, das nichts einlöst.
  it('no campaign type offers the choice yet — everything resolves to private', () => {
    for (const chosen of ['private', 'shared', 'moderated'] as const) {
      expect(resolveVisibility('wedding', chosen)).toBe('private')
      expect(resolveVisibility('agency', chosen)).toBe('private')
      expect(resolveVisibility('stay', chosen)).toBe('private')
    }
    expect(resolveVisibility('wedding')).toBe('private')
  })

  // Festhalten, dass das Abschalten eine bewusste EINZELNE Zeile ist und nicht aus Versehen
  // geschieht: sobald Dilim C existiert, wird hier `true` erwartet.
  it('wedding declares the choice as switched off, not as absent', () => {
    expect(CAMPAIGN_TYPES.wedding?.allowVisibilityChoice).toBe(false)
  })

  it('consentText is staged by visibility for guestbook only', () => {
    const privateText = resolveConsentText('guestbook', 'private')
    const sharedText = resolveConsentText('guestbook', 'shared')
    const moderatedText = resolveConsentText('guestbook', 'moderated')
    expect(privateText).not.toBe(sharedText)
    expect(privateText).not.toBe(moderatedText)
    expect(sharedText).not.toBe(moderatedText)
    // Unverändertes Verhalten für Nicht-guestbook-Modi — visibility bleibt dort per CHECK 'private'.
    expect(resolveConsentText('gallery', 'shared')).toBe(resolveConsentText('gallery', 'private'))
    expect(resolveConsentText('feedback', 'shared')).toBe(resolveConsentText('feedback', 'private'))
  })

  it('resolveLabels defaults to private and threads visibility into consentText', () => {
    const defaulted = resolveLabels('wedding', 'guestbook')
    const shared = resolveLabels('wedding', 'guestbook', 'shared')
    expect(defaulted.consentText).toBe(resolveConsentText('guestbook', 'private'))
    expect(shared.consentText).toBe(resolveConsentText('guestbook', 'shared'))
  })

  it('isEventVisibility narrows only the three active values', () => {
    expect(isEventVisibility('private')).toBe(true)
    expect(isEventVisibility('shared')).toBe(true)
    expect(isEventVisibility('moderated')).toBe(true)
    expect(isEventVisibility('public')).toBe(false)
    expect(isEventVisibility('')).toBe(false)
  })
})
