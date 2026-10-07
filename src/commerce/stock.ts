import type { Payload, PayloadRequest } from 'payload'

import { idOf } from '@/access'
import { availableToSell, pickLots, stockByLot, type LotStock } from '@/lib/inventory'

const today = () => new Date().toISOString().slice(0, 10)

export async function minShelfLifeDays(payload: Payload, req?: PayloadRequest) {
  const settings = await payload.findGlobal({ slug: 'shop-settings', req, overrideAccess: true })
  return settings.minShelfLifeDays ?? 0
}

/** Stock por lote de los productos indicados, a partir del libro de movimientos. */
export async function loadStock(payload: Payload, productIds: Array<string | number>, req?: PayloadRequest): Promise<LotStock[]> {
  const lots = await payload.find({ collection: 'lots', where: { product: { in: productIds } }, depth: 0, limit: 1000, req, overrideAccess: true })
  const movements = await payload.find({ collection: 'stock-movements', where: { product: { in: productIds } }, depth: 0, limit: 10000, req, overrideAccess: true })
  return stockByLot(
    lots.docs.map((l) => ({ id: l.id, productId: idOf(l.product)!, lotNumber: l.lotNumber, expiryDate: l.expiryDate, status: l.status })),
    movements.docs.map((m) => ({ lotId: idOf(m.lot)!, bucket: m.bucket, quantity: m.quantity })),
  )
}

/** Unidades comprometidas en pedidos pagados que aún no se han empaquetado. */
export async function reservedUnits(payload: Payload, productId: string | number, req?: PayloadRequest, excludeOrderId?: string | number) {
  const paid = await payload.find({ collection: 'orders', where: { status: { equals: 'paid' } }, depth: 0, limit: 1000, req, overrideAccess: true })
  return paid.docs
    .filter((o) => String(o.id) !== String(excludeOrderId))
    .flatMap((o) => o.lines ?? [])
    .filter((l) => String(idOf(l.product)) === String(productId))
    .reduce((s, l) => s + l.quantity, 0)
}

export async function available(payload: Payload, productId: string | number, req?: PayloadRequest, excludeOrderId?: string | number) {
  const [stock, reserved, minDays] = await Promise.all([
    loadStock(payload, [productId], req),
    reservedUnits(payload, productId, req, excludeOrderId),
    minShelfLifeDays(payload, req),
  ])
  return availableToSell(stock, productId, reserved, today(), minDays)
}

export async function pickForOrder(payload: Payload, productId: string | number, quantity: number, req?: PayloadRequest) {
  const [stock, minDays] = await Promise.all([loadStock(payload, [productId], req), minShelfLifeDays(payload, req)])
  return pickLots(stock, productId, quantity, today(), minDays)
}
