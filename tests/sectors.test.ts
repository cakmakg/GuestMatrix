import { describe, expect, it } from 'vitest'

import {
  BUSINESS_TYPES,
  CAMPAIGN_TYPES,
  SECTORS,
  SIGNUP_OPTIONS,
  allowedCampaignTypes,
  businessTypesForSector,
  campaignTypesForBusinessType,
  campaignTypesForSector,
  getBusinessTypeConfig,
  getCampaignConfig,
  getCapabilities,
  getFeedbackQuestions,
  getSignupOption,
  isBusinessType,
  isCampaignType,
  isFlowMode,
  isFlowModeAllowed,
  isSector,
  isSignupChoice,
  isValidCampaignForBusinessType,
  isValidCampaignForSector,
  resolveFlowMode,
  resolveLabels,
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

  it('wedding drives the guestbook mode, which captures the guest name', () => {
    expect(resolveFlowMode('wedding')).toBe('guestbook')
    // guestbook ist der einzige Modus, der den Gastnamen erfasst (privater Gruß ans Brautpaar).
    expect(getCapabilities('guestbook').guestNameEnabled).toBe(true)
  })
})
