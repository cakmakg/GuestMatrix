import { describe, expect, it } from 'vitest'

import { DEFAULT_PLAN, PLAN_TUPLE, PLANS, getPlanConfig, isPlan, resolvePlan } from '@/lib/plans'

describe('plan registry integrity', () => {
  it('every tuple value has a config with positive quotas', () => {
    for (const plan of PLAN_TUPLE) {
      const config = PLANS[plan]
      expect(config.label).toBeTruthy()
      expect(config.maxActiveEvents).toBeGreaterThan(0)
      expect(config.maxUploadsPerEvent).toBeGreaterThan(0)
    }
  })

  it('pro has strictly higher quotas than free', () => {
    expect(PLANS.pro.maxActiveEvents).toBeGreaterThan(PLANS.free.maxActiveEvents)
    expect(PLANS.pro.maxUploadsPerEvent).toBeGreaterThan(PLANS.free.maxUploadsPerEvent)
  })
})

describe('isPlan', () => {
  it('accepts known plans and rejects unknown ones', () => {
    expect(isPlan('free')).toBe(true)
    expect(isPlan('pro')).toBe(true)
    expect(isPlan('enterprise')).toBe(false)
    expect(isPlan('')).toBe(false)
  })
})

describe('resolvePlan', () => {
  it('falls back to the default plan for unknown/empty/null values', () => {
    expect(resolvePlan('pro')).toBe('pro')
    expect(resolvePlan('free')).toBe('free')
    expect(resolvePlan('bogus')).toBe(DEFAULT_PLAN)
    expect(resolvePlan(null)).toBe(DEFAULT_PLAN)
    expect(resolvePlan(undefined)).toBe(DEFAULT_PLAN)
  })
})

describe('getPlanConfig', () => {
  it('returns the config for a plan', () => {
    expect(getPlanConfig('free')).toStrictEqual(PLANS.free)
  })
})
