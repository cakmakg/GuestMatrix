import { describe, expect, it } from 'vitest'

import { countContributors, formatAlbumDate, formatTimeOfDay } from '@/lib/dashboard/album'

/**
 * Die Zeitstempel werden aus LOKALEN Bestandteilen gebaut (`new Date(y, m, d, h, min)`) und erst
 * dann nach ISO serialisiert. Sonst hinge das Ergebnis an der Zeitzone des Testlaufs: ein fest
 * geschriebenes `'2026-06-14T21:47:00Z'` fiele östlich von UTC+3 auf den 15. Juni.
 */
function at(year: number, month: number, day: number, hour = 12, minute = 0): string {
  return new Date(year, month - 1, day, hour, minute).toISOString()
}

const SUNDAY_EARLY = at(2026, 6, 14, 0, 30)
const SUNDAY_EVENING = at(2026, 6, 14, 21, 47)

describe('album date and time formats (hand-rolled, ICU-independent)', () => {
  it('writes the album header date', () => {
    expect(formatAlbumDate(SUNDAY_EVENING)).toBe('14. Juni 2026')
    expect(formatAlbumDate(at(2026, 1, 3))).toBe('3. Januar 2026')
    expect(formatAlbumDate(at(2026, 12, 31))).toBe('31. Dezember 2026')
  })

  it('writes the time of day two-digit', () => {
    expect(formatTimeOfDay(SUNDAY_EVENING)).toBe('21:47')
    expect(formatTimeOfDay(SUNDAY_EARLY)).toBe('00:30')
  })

  it('stays renderable for missing or broken values', () => {
    expect(formatAlbumDate(null)).toBe('')
    expect(formatAlbumDate('kein datum')).toBe('')
    expect(formatTimeOfDay(null)).toBe('')
    expect(formatTimeOfDay('kein datum')).toBe('')
  })
})

describe('countContributors: how many guests left something', () => {
  it('counts each guest once, regardless of spelling case', () => {
    expect(
      countContributors([
        { guestName: 'Oma Erna' },
        { guestName: 'oma erna' },
        { guestName: '  Oma Erna  ' },
        { guestName: 'Jonas' },
      ]),
    ).toBe(2)
  })

  it('ignores missing and blank names instead of inventing a guest', () => {
    expect(countContributors([{ guestName: null }, { guestName: '   ' }, {}])).toBe(0)
  })

  it('returns zero for an empty album', () => {
    expect(countContributors([])).toBe(0)
  })
})
