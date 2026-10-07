import { describe, expect, it } from 'vitest'

import { availableToSell, InsufficientStockError, pickLots, stockByLot, type Lot, type Movement } from '@/lib/inventory'
import { orderTotals, toCents } from '@/lib/money'

const today = '2026-10-07'
const lots: Lot[] = [
  { id: 'L1', productId: 'P', lotNumber: 'A-1', expiryDate: '2027-06-30', status: 'available' },
  { id: 'L2', productId: 'P', lotNumber: 'A-2', expiryDate: '2027-01-31', status: 'available' },
  { id: 'L3', productId: 'P', lotNumber: 'A-3', expiryDate: '2026-12-01', status: 'held' },
  { id: 'L4', productId: 'P', lotNumber: 'A-4', expiryDate: '2026-10-20', status: 'available' },
]
const movements: Movement[] = [
  { lotId: 'L1', bucket: 'sellable', quantity: 10 },
  { lotId: 'L2', bucket: 'sellable', quantity: 3 },
  { lotId: 'L3', bucket: 'sellable', quantity: 5 },
  { lotId: 'L4', bucket: 'sellable', quantity: 4 },
  { lotId: 'L1', bucket: 'sellable', quantity: -2 },
  { lotId: 'L1', bucket: 'held', quantity: 1 },
]

describe('existencias', () => {
  const stock = stockByLot(lots, movements)

  it('suma movimientos por lote y separa vendible de retenido', () => {
    expect(stock.find((l) => l.id === 'L1')).toMatchObject({ sellable: 8, held: 1 })
  })

  it('un lote retenido no cuenta como disponible', () => {
    expect(availableToSell(stock, 'P', 0, today)).toBe(8 + 3 + 4)
  })

  it('respeta la vida útil mínima restante', () => {
    // L4 caduca en 13 días: con un mínimo de 30 días ya no se vende.
    expect(availableToSell(stock, 'P', 0, today, 30)).toBe(8 + 3)
  })

  it('descuenta lo reservado por pedidos pagados aún no empaquetados', () => {
    expect(availableToSell(stock, 'P', 5, today, 30)).toBe(6)
  })

  it('asigna lotes por vencimiento más próximo y nunca el retenido', () => {
    expect(pickLots(stock, 'P', 6, today, 30)).toEqual([
      { lotId: 'L2', quantity: 3 },
      { lotId: 'L1', quantity: 3 },
    ])
  })

  it('falla si no hay unidades aptas suficientes', () => {
    expect(() => pickLots(stock, 'P', 20, today, 30)).toThrow(InsufficientStockError)
  })
})

describe('importes', () => {
  it('convierte CHF a céntimos sin errores de coma flotante', () => {
    expect(toCents(19.9)).toBe(1990)
    expect(toCents(0.1 + 0.2)).toBe(30)
  })

  it('calcula totales con IVA incluido', () => {
    const t = orderTotals([{ unitPriceCents: 3900, quantity: 2, vatRate: 2.6 }], 890)
    expect(t).toEqual({ subtotalCents: 7800, shippingCents: 890, totalCents: 8690, vatCents: 198 + 23 })
  })
})
