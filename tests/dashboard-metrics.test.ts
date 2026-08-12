import { describe, expect, it } from 'vitest'

import {
  SPARK_HEIGHT,
  SPARK_WIDTH,
  bucketCounts,
  deltaTone,
  formatNumber,
  formatPercentDelta,
  formatRelative,
  isImprovement,
  percentDelta,
  quotaPercent,
  sparklinePath,
} from '@/lib/dashboard/metrics'

const DAY = 86_400_000
const NOW = Date.UTC(2026, 7, 11) // 2026-08-11

/** y-Koordinaten aus einem Sparkline-`d` herauslösen. */
function yValues(line: string): number[] {
  return line
    .replace('M', '')
    .split(' L')
    .map((point) => Number(point.split(',')[1]))
}

describe('bucketCounts', () => {
  it('places timestamps into the right bucket of the window', () => {
    // Fenster: 4 Eimer à 1 Tag → [NOW-4d, NOW]
    const stamps = [
      NOW - 3.5 * DAY, // Eimer 0
      NOW - 2.5 * DAY, // Eimer 1
      NOW - 1.5 * DAY, // Eimer 2
      NOW - 0.5 * DAY, // Eimer 3
      NOW - 0.2 * DAY, // Eimer 3
    ]
    expect(bucketCounts(stamps, NOW, 4, DAY)).toEqual([1, 1, 1, 2])
  })

  it('ignores timestamps outside the window', () => {
    const stamps = [NOW - 10 * DAY, NOW + DAY, NOW - 0.5 * DAY]
    expect(bucketCounts(stamps, NOW, 4, DAY)).toEqual([0, 0, 0, 1])
  })

  it('counts exactly `now` in the last bucket rather than overflowing', () => {
    expect(bucketCounts([NOW], NOW, 4, DAY)).toEqual([0, 0, 0, 1])
  })

  it('returns a zero-filled array for an empty input', () => {
    expect(bucketCounts([], NOW, 3, DAY)).toEqual([0, 0, 0])
  })

  it('is defensive about degenerate bucket configuration', () => {
    expect(bucketCounts([NOW], NOW, 0, DAY)).toEqual([])
    expect(bucketCounts([NOW], NOW, 2, 0)).toEqual([0, 0])
  })
})

describe('sparklinePath', () => {
  it('spans the full viewBox width and closes the fill to the baseline', () => {
    const { line, fill } = sparklinePath([0, 5, 10])
    expect(line.startsWith('M0,')).toBe(true)
    expect(line).toContain(`${SPARK_WIDTH},`)
    expect(fill.endsWith(`L${SPARK_WIDTH},${SPARK_HEIGHT} L0,${SPARK_HEIGHT} Z`)).toBe(true)
  })

  it('inverts the y axis — the largest value sits highest (smallest y)', () => {
    const ys = yValues(sparklinePath([0, 10]).line)
    expect(ys).toHaveLength(2)
    expect(Number(ys[1])).toBeLessThan(Number(ys[0]))
  })

  it('keeps every point inside the viewBox', () => {
    const ys = yValues(sparklinePath([3, 99, 0, 42, 7]).line)
    expect(ys).toHaveLength(5)
    for (const y of ys) {
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(SPARK_HEIGHT)
    }
  })

  it('draws a flat series down the middle instead of dividing by zero', () => {
    const ys = yValues(sparklinePath([4, 4, 4]).line)
    expect(new Set(ys).size).toBe(1)
    expect(ys.every((y) => Number.isFinite(y))).toBe(true)
  })

  it('returns empty paths when there is nothing to draw', () => {
    expect(sparklinePath([])).toEqual({ line: '', fill: '' })
    expect(sparklinePath([7])).toEqual({ line: '', fill: '' })
  })
})

describe('percentDelta', () => {
  it('computes growth and decline', () => {
    expect(percentDelta(110, 100)).toBeCloseTo(10)
    expect(percentDelta(90, 100)).toBeCloseTo(-10)
    expect(percentDelta(100, 100)).toBe(0)
  })

  it('reports no baseline as null rather than infinity', () => {
    expect(percentDelta(5, 0)).toBeNull()
    expect(Number.isFinite(percentDelta(5, 0) ?? 0)).toBe(true)
  })

  it('treats nothing-to-nothing as unchanged', () => {
    expect(percentDelta(0, 0)).toBe(0)
  })
})

describe('formatPercentDelta', () => {
  it('uses German decimal comma and a real minus sign', () => {
    expect(formatPercentDelta(12.44)).toBe('+12,4 %')
    expect(formatPercentDelta(-3.14)).toBe('−3,1 %')
    expect(formatPercentDelta(0)).toBe('±0,0 %')
  })

  it('uses U+2212 for negatives, not the ASCII hyphen', () => {
    expect(formatPercentDelta(-5)).toContain('−')
    expect(formatPercentDelta(-5)).not.toContain('-')
  })

  it('labels a missing baseline', () => {
    expect(formatPercentDelta(null)).toBe('Neu')
  })
})

describe('deltaTone', () => {
  it('maps sign to tone', () => {
    expect(deltaTone(4)).toBe('up')
    expect(deltaTone(-4)).toBe('down')
    expect(deltaTone(0)).toBe('flat')
    expect(deltaTone(null)).toBe('new')
  })
})

describe('formatNumber', () => {
  it('groups thousands with a dot', () => {
    expect(formatNumber(1247)).toBe('1.247')
    expect(formatNumber(999)).toBe('999')
    expect(formatNumber(1234567)).toBe('1.234.567')
  })

  it('uses a comma for decimals', () => {
    expect(formatNumber(4.7, 1)).toBe('4,7')
    expect(formatNumber(1234.56, 2)).toBe('1.234,56')
  })
})

describe('isImprovement', () => {
  it('reads a rise as good when higher is better', () => {
    expect(isImprovement('up')).toBe(true)
    expect(isImprovement('down')).toBe(false)
  })

  // Der Kern: mehr offene Punkte darf nicht wie ein Erfolg aussehen.
  it('inverts the meaning when lower is better', () => {
    expect(isImprovement('up', false)).toBe(false)
    expect(isImprovement('down', false)).toBe(true)
  })

  it('is neither good nor bad without a change or a baseline', () => {
    expect(isImprovement('flat')).toBeNull()
    expect(isImprovement('new')).toBeNull()
    expect(isImprovement('flat', false)).toBeNull()
    expect(isImprovement('new', false)).toBeNull()
  })

  it('agrees with deltaTone end to end', () => {
    // Kritische Rückmeldungen: 4 diesen Monat gegen 10 im Vormonat = Verbesserung.
    expect(isImprovement(deltaTone(percentDelta(4, 10)), false)).toBe(true)
    // Zufriedenheit: 4 gegen 10 = Verschlechterung.
    expect(isImprovement(deltaTone(percentDelta(4, 10)))).toBe(false)
  })
})

describe('formatRelative', () => {
  const iso = (offsetMs: number): string => new Date(NOW - offsetMs).toISOString()

  it('describes recent moments in German', () => {
    expect(formatRelative(iso(30_000), NOW)).toBe('gerade eben')
    expect(formatRelative(iso(5 * 60_000), NOW)).toBe('vor 5 Min.')
    expect(formatRelative(iso(3 * 3_600_000), NOW)).toBe('vor 3 Std.')
    expect(formatRelative(iso(DAY), NOW)).toBe('gestern')
    expect(formatRelative(iso(4 * DAY), NOW)).toBe('vor 4 Tagen')
  })

  it('switches to an absolute date beyond 30 days', () => {
    const result = formatRelative(iso(90 * DAY), NOW)
    expect(result).not.toContain('vor')
    expect(result).toMatch(/\d/)
  })

  it('returns an empty string for a missing or unparsable timestamp', () => {
    expect(formatRelative(null, NOW)).toBe('')
    expect(formatRelative('not-a-date', NOW)).toBe('')
  })
})

describe('quotaPercent', () => {
  it('clamps to 0…100', () => {
    expect(quotaPercent(50, 200)).toBe(25)
    expect(quotaPercent(300, 200)).toBe(100)
    expect(quotaPercent(-5, 200)).toBe(0)
  })

  it('does not divide by a zero limit', () => {
    expect(quotaPercent(5, 0)).toBe(0)
  })
})
