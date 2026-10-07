import { APIError, type Payload, type PayloadRequest } from 'payload'

import { idOf } from '@/access'
import { orderTotals, toCents } from '@/lib/money'

import { available } from './stock'

export interface CheckoutInput {
  customerId: string | number
  items: Array<{ productId: string | number; quantity: number }>
  shippingCode: string
  address: { name: string; street: string; addressLine2?: string; postalCode: string; city: string; country?: string }
  language?: 'de' | 'en'
}

/**
 * Crea un pedido pendiente de pago. Los precios, el IVA y el envío se toman
 * siempre del servidor, nunca de lo que envía el navegador. Comprobar stock
 * aquí no reserva: la reserva cuenta desde el pago confirmado.
 */
export async function createOrder(payload: Payload, input: CheckoutInput, req?: PayloadRequest) {
  if (!input.items?.length) throw new APIError('El carrito está vacío.', 400, undefined, true)
  const address = input.address
  if (!address?.name || !address.street || !address.postalCode || !address.city) {
    throw new APIError('Falta la dirección de entrega.', 400, undefined, true)
  }
  if ((address.country ?? 'CH') !== 'CH') throw new APIError('Solo enviamos dentro de Suiza.', 400, undefined, true)

  const customer = await payload.findByID({ collection: 'customers', id: input.customerId, depth: 0, req, overrideAccess: true })
  const settings = await payload.findGlobal({ slug: 'shop-settings', req, overrideAccess: true })
  const shipping = settings.shippingOptions?.find((o) => o.code === input.shippingCode)
  if (!shipping) throw new APIError('Opción de envío no válida.', 400, undefined, true)

  const merged = new Map<string, number>()
  for (const item of input.items) {
    const q = Math.floor(Number(item.quantity))
    if (!Number.isFinite(q) || q < 1 || q > 20) throw new APIError('Cantidad no válida.', 400, undefined, true)
    merged.set(String(item.productId), (merged.get(String(item.productId)) ?? 0) + q)
  }

  const lines = []
  for (const [productId, quantity] of merged) {
    const product = await payload.findByID({ collection: 'products', id: productId, depth: 0, req, overrideAccess: true })
    if (product.saleStatus !== 'for-sale' || product.price == null) {
      throw new APIError(`«${product.name}» no está a la venta.`, 400, undefined, true)
    }
    const stock = await available(payload, productId, req)
    if (stock < quantity) throw new APIError(`De «${product.name}» quedan ${stock} unidades.`, 409, undefined, true)
    lines.push({
      product: product.id,
      formulation: idOf(product.currentFormulation)!,
      productName: product.name,
      unitPriceCents: toCents(product.price),
      quantity,
      vatRate: product.vatRate ?? 0,
    })
  }

  const totals = orderTotals(lines, toCents(shipping.price), settings.shippingVatRate ?? undefined)
  const count = await payload.count({ collection: 'orders', req, overrideAccess: true })
  const year = new Date().getFullYear()

  return payload.create({
    collection: 'orders',
    data: {
      orderNumber: `N-${year}-${String(count.totalDocs + 1).padStart(5, '0')}`,
      customer: customer.id,
      email: customer.email,
      language: input.language ?? (customer.language as 'de' | 'en'),
      status: 'pending-payment',
      lines,
      totals,
      shippingMethod: { code: shipping.code, label: shipping.label, priceCents: toCents(shipping.price) },
      shippingAddress: { ...address, country: 'CH' },
      payment: { status: 'pending' },
    },
    req,
    overrideAccess: true,
    context: { system: true },
  })
}
