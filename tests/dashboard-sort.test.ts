import { describe, expect, it } from 'vitest'

import { hrefWith } from '@/lib/dashboard/filter-chips'
import { flipDir, sortHeaderState, withDir } from '@/lib/dashboard/sort'

const BASE = '/dashboard/experiences'

describe('sortHeaderState', () => {
  it('offers the first direction for a column that is not sorted yet', () => {
    const state = sortHeaderState('name', 'asc', 'date', 'desc')
    expect(state.active).toBe(false)
    expect(state.next).toEqual({ sort: 'name', dir: 'asc' })
  })

  // Das ist der ganze Gewinn der Richtung: derselbe Klick führt zur umgekehrten Ordnung, statt
  // die Spalte erneut so zu sortieren, wie sie schon steht.
  it('turns the direction around on the column that is already sorted', () => {
    expect(sortHeaderState('date', 'desc', 'date', 'desc').next).toEqual({
      sort: 'date',
      dir: 'asc',
    })
    expect(sortHeaderState('date', 'desc', 'date', 'asc').next).toEqual({
      sort: 'date',
      dir: 'desc',
    })
  })

  it('marks only the sorted column as active', () => {
    expect(sortHeaderState('date', 'desc', 'date', 'asc').active).toBe(true)
    expect(sortHeaderState('responses', 'desc', 'date', 'asc').active).toBe(false)
  })

  // Die Erstrichtung ist eine Aussage über die SPALTE: Namen A–Z, Zahlen und Daten das
  // Größte/Neueste zuerst. Sie darf nicht von der aktuellen Richtung der anderen Spalte erben.
  it('does not inherit the direction of the previously sorted column', () => {
    expect(sortHeaderState('name', 'asc', 'responses', 'desc').next.dir).toBe('asc')
    expect(sortHeaderState('responses', 'desc', 'name', 'asc').next.dir).toBe('desc')
  })
})

describe('flipDir / withDir', () => {
  it('flips both ways', () => {
    expect(flipDir('asc')).toBe('desc')
    expect(flipDir('desc')).toBe('asc')
  })

  it('passes an ascending comparison through and negates it for desc', () => {
    expect(withDir(-1, 'asc')).toBe(-1)
    expect(withDir(-1, 'desc')).toBe(1)
    // Gleichstand bleibt Gleichstand, sonst würde die stabile Sortierung unterlaufen. Verglichen
    // mit `===` und nicht mit `toBe`: das Negieren macht aus 0 ein -0, und `Object.is` (das `toBe`
    // benutzt) unterscheidet die beiden. `Array.prototype.sort` tut das nicht — es fragt nur nach
    // „kleiner als 0" bzw. „größer als 0", und -0 ist keines von beiden.
    expect(withDir(0, 'desc') === 0).toBe(true)
  })
})

describe('sort links keep the rest of the address', () => {
  // Der eigentliche Fallstrick beim Sortieren über Links: ein Klick auf die Überschrift darf den
  // gesetzten Filter nicht abwerfen.
  it('carries the active filters into the new order', () => {
    const href = hrefWith(BASE, { state: 'archived' }, { sort: 'name', dir: 'asc' })
    expect(href).toBe(`${BASE}?state=archived&sort=name&dir=asc`)
  })

  it('drops values the patch sets to undefined', () => {
    // So verschwindet die Sortierung wieder aus der Adresse, sobald sie dem Standard entspricht.
    expect(hrefWith(BASE, { state: 'all', sort: 'name' }, { sort: undefined })).toBe(
      `${BASE}?state=all`,
    )
    expect(hrefWith(BASE, {}, { sort: undefined })).toBe(BASE)
  })

  it('keeps a key in its original position when the patch overwrites it', () => {
    // Dieselbe Ansicht soll dieselbe Adresse haben, unabhängig davon, über welchen Klick man
    // hingekommen ist.
    const viaState = hrefWith(BASE, { state: 'all', sort: 'date' }, { sort: 'name' })
    const viaSort = hrefWith(BASE, { state: 'all', sort: 'name' }, { state: 'all' })
    expect(viaState).toBe(viaSort)
  })

  it('escapes values instead of splicing them into the query', () => {
    expect(hrefWith(BASE, {}, { sort: 'a&b=c d' })).toBe(`${BASE}?sort=a%26b%3Dc+d`)
  })
})
