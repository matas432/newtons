/**
 * Existencias por lote (Libro 1 v2.0, cap. 3, 9 y 10). Funciones puras.
 *
 * - El stock es un libro de movimientos: nunca se edita una cantidad a mano.
 * - Cada lote tiene dos «cajones»: vendible y retenido. Las devoluciones o los
 *   productos de conservación dudosa entran como retenidos y no vuelven solos
 *   al stock vendible.
 * - Un lote retenido, retirado o caducado (o con vida útil insuficiente) no se vende.
 * - Al empaquetar se asigna el lote apto con vencimiento más próximo (FEFO).
 */

import { addDays, type ISODate } from './schedule'

export type Bucket = 'sellable' | 'held'

export interface Movement {
  lotId: string | number
  bucket: Bucket
  /** Positivo entra, negativo sale. */
  quantity: number
}

export interface Lot {
  id: string | number
  productId: string | number
  lotNumber: string
  expiryDate: ISODate
  status: 'available' | 'held' | 'recalled'
}

export interface LotStock extends Lot {
  sellable: number
  held: number
}

export function stockByLot(lots: Lot[], movements: Movement[]): LotStock[] {
  const totals = new Map<string, { sellable: number; held: number }>()
  for (const m of movements) {
    const key = String(m.lotId)
    const t = totals.get(key) ?? { sellable: 0, held: 0 }
    t[m.bucket] += m.quantity
    totals.set(key, t)
  }
  return lots.map((lot) => ({ ...lot, ...(totals.get(String(lot.id)) ?? { sellable: 0, held: 0 }) }))
}

/** ¿Se puede vender de este lote hoy? Exige estado disponible y vida útil restante mínima. */
export function isSellableLot(lot: Lot, today: ISODate, minShelfLifeDays = 0): boolean {
  return lot.status === 'available' && lot.expiryDate > addDays(today, minShelfLifeDays)
}

/** Unidades que se pueden prometer en un pedido nuevo. */
export function availableToSell(
  stock: LotStock[],
  productId: string | number,
  reservedUnits: number,
  today: ISODate,
  minShelfLifeDays = 0,
): number {
  const onHand = stock
    .filter((l) => String(l.productId) === String(productId) && isSellableLot(l, today, minShelfLifeDays))
    .reduce((sum, l) => sum + Math.max(0, l.sellable), 0)
  return Math.max(0, onHand - reservedUnits)
}

export class InsufficientStockError extends Error {
  constructor(
    public productId: string | number,
    public needed: number,
    public available: number,
  ) {
    super(`Stock insuficiente: se necesitan ${needed}, hay ${available} aptas.`)
  }
}

/** Asigna lotes aptos por vencimiento más próximo (FEFO). No asigna lotes retenidos ni caducados. */
export function pickLots(
  stock: LotStock[],
  productId: string | number,
  quantity: number,
  today: ISODate,
  minShelfLifeDays = 0,
): Array<{ lotId: string | number; quantity: number }> {
  const candidates = stock
    .filter((l) => String(l.productId) === String(productId) && isSellableLot(l, today, minShelfLifeDays) && l.sellable > 0)
    .sort((a, b) => (a.expiryDate < b.expiryDate ? -1 : a.expiryDate > b.expiryDate ? 1 : 0))
  const picks: Array<{ lotId: string | number; quantity: number }> = []
  let remaining = quantity
  for (const lot of candidates) {
    if (remaining <= 0) break
    const take = Math.min(lot.sellable, remaining)
    picks.push({ lotId: lot.id, quantity: take })
    remaining -= take
  }
  if (remaining > 0) throw new InsufficientStockError(productId, quantity, quantity - remaining)
  return picks
}
