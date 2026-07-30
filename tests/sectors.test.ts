import { describe, expect, it } from 'vitest'

import {
  CAMPAIGN_TYPES,
  SECTORS,
  campaignTypesForSector,
  getCampaignConfig,
  getCapabilities,
  isCampaignType,
  isFlowMode,
  isFlowModeAllowed,
  isSector,
  isValidCampaignForSector,
  resolveFlowMode,
  resolveLabels,
} from '@/lib/sectors'
import { tourism } from '@/lib/sectors/tourism'

// Aktiver Umfang (0006 Retrenchment + 0009 Öffnung): Sektor tourism mit tour (gallery) UND
// stay (feedback). Weiterhin GESPERRT: real_estate/event und der Modus guestbook — als Code
// vorhanden (types.ts hält die Tupel breit), aber nicht registriert und per DB-CHECK nicht
// speicherbar. Diese Tests fixieren die aktive Registry. Siehe docs/extension-points.md.

describe('active registry: tourism with tour (gallery) + stay (feedback)', () => {
  it('registers exactly the tourism sector with tour + stay', () => {
    expect(Object.keys(SECTORS)).toEqual(['tourism'])
    expect(SECTORS.tourism?.label).toBe(tourism.label)
    expect(SECTORS.tourism?.campaignTypes).toEqual(['tour', 'stay'])
  })

  it('registers exactly the tour and stay campaign types', () => {
    expect(Object.keys(CAMPAIGN_TYPES)).toEqual(['tour', 'stay'])
    expect(campaignTypesForSector('tourism')).toEqual(['tour', 'stay'])
  })

  it('tour is a gallery campaign with no operator flow-mode choice', () => {
    const config = getCampaignConfig('tour')
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
})

describe('deactivated sectors / campaign types / modes stay rejected', () => {
  it('only tourism is a recognised sector', () => {
    expect(isSector('tourism')).toBe(true)
    for (const s of ['real_estate', 'event', 'retail']) {
      expect(isSector(s)).toBe(false)
    }
  })

  it('tour and stay are recognised; property/wedding are not', () => {
    expect(isCampaignType('tour')).toBe(true)
    expect(isCampaignType('stay')).toBe(true)
    for (const t of ['property', 'wedding', 'cruise']) {
      expect(isCampaignType(t)).toBe(false)
    }
  })

  it('campaignTypesForSector returns empty for unregistered sectors', () => {
    expect(campaignTypesForSector('real_estate')).toEqual([])
    expect(campaignTypesForSector('event')).toEqual([])
  })

  it('getCampaignConfig returns undefined for still-deactivated types', () => {
    expect(getCampaignConfig('wedding')).toBeUndefined()
    expect(getCampaignConfig('property')).toBeUndefined()
  })

  it('isValidCampaignForSector accepts tourism/tour + tourism/stay only', () => {
    expect(isValidCampaignForSector('tourism', 'tour')).toBe(true)
    expect(isValidCampaignForSector('tourism', 'stay')).toBe(true)
    expect(isValidCampaignForSector('tourism', 'wedding')).toBe(false)
    expect(isValidCampaignForSector('event', 'wedding')).toBe(false)
  })
})

describe('flow-mode resolution: tour→gallery, stay→feedback', () => {
  it('tour always resolves to gallery, ignoring any chosen mode', () => {
    expect(resolveFlowMode('tour')).toBe('gallery')
    expect(resolveFlowMode('tour', 'feedback')).toBe('gallery')
    expect(resolveFlowMode('tour', 'guestbook')).toBe('gallery')
  })

  it('stay always resolves to feedback, ignoring any chosen mode', () => {
    expect(resolveFlowMode('stay')).toBe('feedback')
    expect(resolveFlowMode('stay', 'gallery')).toBe('feedback')
  })

  it('deactivated campaign types fall back to gallery', () => {
    expect(resolveFlowMode('wedding')).toBe('gallery')
    expect(resolveFlowMode('property', 'feedback')).toBe('gallery')
  })

  it('isFlowModeAllowed matches each campaign default only', () => {
    expect(isFlowModeAllowed('tour', 'gallery')).toBe(true)
    expect(isFlowModeAllowed('tour', 'feedback')).toBe(false)
    expect(isFlowModeAllowed('stay', 'feedback')).toBe(true)
    expect(isFlowModeAllowed('stay', 'gallery')).toBe(false)
    expect(isFlowModeAllowed('wedding', 'guestbook')).toBe(false)
  })
})

describe('active flow labels + capabilities (gallery + feedback)', () => {
  it('gallery requires media and enables gallery + reciprocity', () => {
    const caps = getCapabilities('gallery')
    expect(caps.mediaRequired).toBe(true)
    expect(caps.galleryEnabled).toBe(true)
    expect(caps.reciprocityEnabled).toBe(true)
  })

  it('feedback has no gallery/reciprocity but enables rating + comment', () => {
    const caps = getCapabilities('feedback')
    expect(caps.mediaRequired).toBe(false)
    expect(caps.galleryEnabled).toBe(false)
    expect(caps.reciprocityEnabled).toBe(false)
    expect(caps.ratingEnabled).toBe(true)
    expect(caps.commentEnabled).toBe(true)
  })

  it('resolveLabels combines the tour headline with gallery consent/success text', () => {
    const labels = resolveLabels('tour', 'gallery')
    expect(labels.landingHeadline).toBe(getCampaignConfig('tour')?.labels.landingHeadline)
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

describe('guestbook stays dormant but type-guard-valid for future re-enablement', () => {
  it('gallery/feedback are active flow-mode types; unknown strings are rejected', () => {
    expect(isFlowMode('gallery')).toBe(true)
    expect(isFlowMode('feedback')).toBe(true)
    expect(isFlowMode('none')).toBe(false)
  })

  it('guestbook remains a valid flow-mode *type* though no campaign can use it', () => {
    // Der Typ bleibt (types.ts unverändert); die Sperre ist Registry + DB-CHECK, nicht das
    // Typsystem. Die guestbook-Capabilities bleiben für eine spätere Wiederaktivierung erhalten.
    expect(isFlowMode('guestbook')).toBe(true)
    expect(getCapabilities('guestbook').guestNameEnabled).toBe(true)
  })
})
