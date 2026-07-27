import { describe, expect, it } from 'vitest'

import {
  CAMPAIGN_TYPES,
  CAMPAIGN_TYPE_TUPLE,
  FLOW_MODE_TUPLE,
  SECTORS,
  SECTOR_TUPLE,
  campaignTypesForSector,
  getCapabilities,
  isCampaignType,
  isFlowMode,
  isFlowModeAllowed,
  isSector,
  isValidCampaignForSector,
  resolveFlowMode,
  resolveLabels,
} from '@/lib/sectors'
import { event } from '@/lib/sectors/event'
import { realEstate } from '@/lib/sectors/real_estate'
import { tourism } from '@/lib/sectors/tourism'

describe('registry integrity', () => {
  it('every campaign type references a valid sector and default flow mode', () => {
    for (const type of CAMPAIGN_TYPE_TUPLE) {
      const config = CAMPAIGN_TYPES[type]
      expect(SECTOR_TUPLE).toContain(config.sector)
      expect(FLOW_MODE_TUPLE).toContain(config.defaultFlowMode)
    }
  })

  it('every campaign type is listed under exactly its own sector', () => {
    for (const type of CAMPAIGN_TYPE_TUPLE) {
      const sector = CAMPAIGN_TYPES[type].sector
      expect(SECTORS[sector].campaignTypes).toContain(type)
    }
  })

  it('every sector lists only campaign types that point back to it', () => {
    for (const sector of SECTOR_TUPLE) {
      for (const type of SECTORS[sector].campaignTypes) {
        expect(CAMPAIGN_TYPES[type].sector).toBe(sector)
      }
    }
  })
})

describe('campaignTypesForSector', () => {
  it('maps tourism to tour and stay', () => {
    expect(campaignTypesForSector('tourism')).toEqual(['tour', 'stay'])
  })

  it('maps real_estate to property and event to wedding', () => {
    expect(campaignTypesForSector('real_estate')).toEqual(['property'])
    expect(campaignTypesForSector('event')).toEqual(['wedding'])
  })
})

describe('isValidCampaignForSector', () => {
  it('accepts a matching pair', () => {
    expect(isValidCampaignForSector('tourism', 'stay')).toBe(true)
  })

  it('rejects a mismatched pair', () => {
    expect(isValidCampaignForSector('event', 'stay')).toBe(false)
    expect(isValidCampaignForSector('tourism', 'wedding')).toBe(false)
  })
})

describe('flow mode resolution', () => {
  it('only property allows the operator to choose the flow mode', () => {
    expect(CAMPAIGN_TYPES.property.allowFlowModeChoice).toBe(true)
    for (const type of ['tour', 'stay', 'wedding'] as const) {
      expect(CAMPAIGN_TYPES[type].allowFlowModeChoice).toBe(false)
    }
  })

  it('honours the chosen mode only when the type allows a choice', () => {
    expect(resolveFlowMode('property', 'gallery')).toBe('gallery')
    expect(resolveFlowMode('property', 'feedback')).toBe('feedback')
    // tour ignores the choice and falls back to its default
    expect(resolveFlowMode('tour', 'feedback')).toBe('gallery')
    expect(resolveFlowMode('stay', null)).toBe('feedback')
  })

  it('isFlowModeAllowed matches the choice policy', () => {
    expect(isFlowModeAllowed('property', 'gallery')).toBe(true)
    expect(isFlowModeAllowed('property', 'feedback')).toBe(true)
    expect(isFlowModeAllowed('tour', 'feedback')).toBe(false)
    expect(isFlowModeAllowed('tour', 'gallery')).toBe(true)
  })
})

describe('capabilities', () => {
  it('gallery requires media and enables the gallery/reciprocity', () => {
    const caps = getCapabilities('gallery')
    expect(caps.mediaRequired).toBe(true)
    expect(caps.galleryEnabled).toBe(true)
    expect(caps.reciprocityEnabled).toBe(true)
  })

  it('feedback makes media optional and disables the gallery', () => {
    const caps = getCapabilities('feedback')
    expect(caps.mediaRequired).toBe(false)
    expect(caps.galleryEnabled).toBe(false)
    expect(caps.reciprocityEnabled).toBe(false)
    expect(caps.commentEnabled).toBe(true)
  })
})

describe('resolveLabels', () => {
  it('combines type headline with mode-specific consent/success text', () => {
    const gallery = resolveLabels('wedding', 'gallery')
    expect(gallery.landingHeadline).toBe(CAMPAIGN_TYPES.wedding.labels.landingHeadline)
    expect(gallery.consentText).toContain('sichtbar')

    const feedback = resolveLabels('property', 'feedback')
    expect(feedback.ratingPrompt).toBe(CAMPAIGN_TYPES.property.labels.ratingPrompt)
    expect(feedback.consentText).toContain('Veranstalter')
  })
})

describe('string narrowing guards', () => {
  it('accepts known values and rejects unknown ones', () => {
    expect(isSector('tourism')).toBe(true)
    expect(isSector('retail')).toBe(false)
    expect(isCampaignType('property')).toBe(true)
    expect(isCampaignType('cruise')).toBe(false)
    expect(isFlowMode('feedback')).toBe(true)
    expect(isFlowMode('none')).toBe(false)
  })
})

describe('per-sector modules aggregate into the registry', () => {
  it('each module label appears in SECTORS', () => {
    expect(SECTORS.tourism.label).toBe(tourism.label)
    expect(SECTORS.real_estate.label).toBe(realEstate.label)
    expect(SECTORS.event.label).toBe(event.label)
  })

  it('each module campaign type is registered under its own sector', () => {
    for (const sectorModule of [tourism, realEstate, event]) {
      for (const [type, config] of Object.entries(sectorModule.campaignTypes)) {
        expect(config?.sector).toBe(sectorModule.id)
        expect(CAMPAIGN_TYPES[type as keyof typeof CAMPAIGN_TYPES]).toStrictEqual(config)
      }
    }
  })
})
