import { describe, expect, it } from 'vitest'

import { dailyTotals, type DoseLine } from '@/lib/doses'

const line = (over: Partial<DoseLine>): DoseLine => ({
  planItemId: 1,
  productName: 'A',
  servingsPerDay: 1,
  scheduled: true,
  formulationVerified: true,
  composition: [{ ingredientId: 'vitD', amount: 100, unit: 'ug', basis: 'active' }],
  ...over,
})

describe('suma de ingredientes por día', () => {
  it('suma el mismo ingrediente de varios productos (ejemplo del Libro 1: 100 + 50 = 150)', () => {
    const r = dailyTotals(
      [line({}), line({ planItemId: 2, productName: 'B', composition: [{ ingredientId: 'vitD', amount: 50, unit: 'ug', basis: 'active' }] })],
      [],
    )
    expect(r.totals).toEqual([{ ingredientId: 'vitD', unit: 'ug', basis: 'active', scheduled: 150, confirmed: 0 }])
    expect(r.complete).toBe(true)
  })

  it('separa programado y confirmado', () => {
    const r = dailyTotals([line({ servingsPerDay: 2 })], [{ planItemId: 1, status: 'taken', servings: 1 }])
    expect(r.totals[0]).toMatchObject({ scheduled: 200, confirmed: 100 })
  })

  it('una omisión no cuenta como tomada', () => {
    const r = dailyTotals([line({})], [{ planItemId: 1, status: 'skipped' }])
    expect(r.totals[0]).toMatchObject({ scheduled: 100, confirmed: 0 })
  })

  it('no suma unidades ni bases distintas', () => {
    const r = dailyTotals(
      [line({}), line({ planItemId: 2, composition: [{ ingredientId: 'vitD', amount: 4000, unit: 'IU', basis: 'active' }] })],
      [],
    )
    expect(r.totals).toHaveLength(2)
  })

  it('excluye productos no verificados y lo declara', () => {
    const r = dailyTotals([line({}), line({ planItemId: 2, productName: 'Externo', formulationVerified: false })], [])
    expect(r.totals[0].scheduled).toBe(100)
    expect(r.unverifiedProducts).toEqual(['Externo'])
    expect(r.complete).toBe(false)
  })

  it('no atribuye mezclas sin desglose ni cantidades no declaradas', () => {
    const r = dailyTotals(
      [line({ composition: [{ ingredientId: 'mix', amount: 500, unit: 'mg', basis: 'blend' }, { ingredientId: 'x', amount: null, unit: 'mg', basis: 'active' }] })],
      [],
    )
    expect(r.totals).toEqual([])
    expect(r.undeclared).toHaveLength(2)
    expect(r.complete).toBe(false)
  })

  it('cuenta tomas de uso selectivo aunque no estén programadas', () => {
    const r = dailyTotals([line({ scheduled: false })], [{ planItemId: 1, status: 'taken', servings: 1 }, { planItemId: 1, status: 'taken', servings: 1 }])
    expect(r.totals[0]).toMatchObject({ scheduled: 0, confirmed: 200 })
  })
})
