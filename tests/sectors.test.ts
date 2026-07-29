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

// Retrenchment (Migration 0006): Aktiv registriert ist NUR tourism / tour / gallery — die
// einzige MVP-Validierungsbahn. Die übrigen Sektoren/Kampagnentypen/Modi bleiben als Code
// vorhanden (types.ts hält die Tupel bewusst breit), sind aber nicht registriert und per
// DB-CHECK nicht speicherbar. Diese Tests beweisen die aktive Sperre. Siehe
// docs/extension-points.md für die Wiederaktivierung.

describe('active registry is locked to tourism / tour / gallery', () => {
  it('registers exactly the tourism sector', () => {
    expect(Object.keys(SECTORS)).toEqual(['tourism'])
    expect(SECTORS.tourism?.label).toBe(tourism.label)
    expect(SECTORS.tourism?.campaignTypes).toEqual(['tour'])
  })

  it('registers exactly the tour campaign type', () => {
    expect(Object.keys(CAMPAIGN_TYPES)).toEqual(['tour'])
    expect(campaignTypesForSector('tourism')).toEqual(['tour'])
  })

  it('tour is a gallery campaign with no operator flow-mode choice', () => {
    const config = getCampaignConfig('tour')
    expect(config?.sector).toBe('tourism')
    expect(config?.defaultFlowMode).toBe('gallery')
    expect(config?.allowFlowModeChoice).toBe(false)
  })
})

describe('deactivated sectors / campaign types are rejected by the registry', () => {
  it('only tourism is a recognised sector', () => {
    expect(isSector('tourism')).toBe(true)
    for (const s of ['real_estate', 'event', 'retail']) {
      expect(isSector(s)).toBe(false)
    }
  })

  it('only tour is a recognised campaign type', () => {
    expect(isCampaignType('tour')).toBe(true)
    for (const t of ['stay', 'property', 'wedding', 'cruise']) {
      expect(isCampaignType(t)).toBe(false)
    }
  })

  it('campaignTypesForSector returns empty for unregistered sectors', () => {
    expect(campaignTypesForSector('real_estate')).toEqual([])
    expect(campaignTypesForSector('event')).toEqual([])
  })

  it('getCampaignConfig returns undefined for deactivated types', () => {
    expect(getCampaignConfig('stay')).toBeUndefined()
    expect(getCampaignConfig('wedding')).toBeUndefined()
  })

  it('isValidCampaignForSector only accepts tourism/tour', () => {
    expect(isValidCampaignForSector('tourism', 'tour')).toBe(true)
    expect(isValidCampaignForSector('tourism', 'stay')).toBe(false)
    expect(isValidCampaignForSector('event', 'wedding')).toBe(false)
  })
})

describe('flow-mode resolution collapses to the single active gallery path', () => {
  it('tour always resolves to gallery, ignoring any chosen mode', () => {
    expect(resolveFlowMode('tour')).toBe('gallery')
    expect(resolveFlowMode('tour', 'feedback')).toBe('gallery')
    expect(resolveFlowMode('tour', 'guestbook')).toBe('gallery')
  })

  it('deactivated campaign types fall back to gallery', () => {
    expect(resolveFlowMode('wedding')).toBe('gallery')
    expect(resolveFlowMode('stay', 'feedback')).toBe('gallery')
  })

  it('isFlowModeAllowed permits only gallery for tour and false for unknown types', () => {
    expect(isFlowModeAllowed('tour', 'gallery')).toBe(true)
    expect(isFlowModeAllowed('tour', 'feedback')).toBe(false)
    expect(isFlowModeAllowed('wedding', 'guestbook')).toBe(false)
  })
})

describe('active gallery flow labels + capabilities', () => {
  it('gallery requires media and enables gallery + reciprocity', () => {
    const caps = getCapabilities('gallery')
    expect(caps.mediaRequired).toBe(true)
    expect(caps.galleryEnabled).toBe(true)
    expect(caps.reciprocityEnabled).toBe(true)
  })

  it('resolveLabels combines the tour headline with gallery consent/success text', () => {
    const labels = resolveLabels('tour', 'gallery')
    expect(labels.landingHeadline).toBe(getCampaignConfig('tour')?.labels.landingHeadline)
    expect(labels.consentText).toContain('sichtbar')
    expect(labels.successText).toBeTruthy()
  })
})

describe('flow-mode type guard stays forward-compatible for re-enablement', () => {
  it('gallery is a known flow-mode type; unknown strings are rejected', () => {
    expect(isFlowMode('gallery')).toBe(true)
    expect(isFlowMode('none')).toBe(false)
  })

  it('feedback/guestbook remain valid flow-mode *types* though no campaign can use them', () => {
    // Der Typ bleibt (types.ts unverändert); die Sperre ist Registry + DB-CHECK, nicht das
    // Typsystem. Die Capabilities-Vorlagen bleiben für die Wiederaktivierung erhalten.
    expect(isFlowMode('feedback')).toBe(true)
    expect(isFlowMode('guestbook')).toBe(true)
    expect(getCapabilities('guestbook').guestNameEnabled).toBe(true)
  })
})
