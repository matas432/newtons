import type { Payload, PayloadRequest } from 'payload'

import { available } from './stock'

export interface PaymentEventInput {
  provider: 'simulated' | 'stripe' | 'payrexx'
  /** Identificador único del evento en el proveedor. */
  eventId: string
  type: 'payment.succeeded' | 'payment.failed'
  orderId: string | number
  amountCents: number
}

export type PaymentOutcome = 'paid' | 'failed' | 'duplicate' | 'ignored' | 'amount-mismatch'

/**
 * Registra un evento de pago una sola vez (Libro 1 v2.0, cap. 9: «registrar el
 * evento una sola vez; no duplicar cobros ni pedidos ante reintentos»).
 * El proveedor puede reenviar el mismo evento: el identificador único hace
 * que el segundo intento no tenga ningún efecto.
 */
export async function recordPaymentEvent(payload: Payload, ev: PaymentEventInput, req?: PayloadRequest): Promise<PaymentOutcome> {
  const seen = await payload.find({ collection: 'payment-events', where: { eventId: { equals: ev.eventId } }, limit: 1, depth: 0, req, overrideAccess: true })
  if (seen.docs.length) return 'duplicate'

  let event
  try {
    event = await payload.create({
      collection: 'payment-events',
      data: { provider: ev.provider, eventId: ev.eventId, type: ev.type, order: Number(ev.orderId), amountCents: ev.amountCents, outcome: 'received' },
      req,
      overrideAccess: true,
    })
  } catch {
    // Dos entregas simultáneas: la restricción de unicidad deja pasar solo una.
    return 'duplicate'
  }

  const order = await payload.findByID({ collection: 'orders', id: ev.orderId, depth: 0, req, overrideAccess: true })
  let outcome: PaymentOutcome
  if (order.status !== 'pending-payment') {
    outcome = 'ignored'
  } else if (ev.type === 'payment.failed') {
    await payload.update({ collection: 'orders', id: order.id, data: { payment: { ...order.payment, provider: ev.provider, status: 'failed' } }, req, overrideAccess: true, context: { system: true } })
    outcome = 'failed'
  } else if (ev.amountCents !== order.totals?.totalCents) {
    await payload.update({
      collection: 'orders',
      id: order.id,
      data: { incidents: `${order.incidents ?? ''}\nPago recibido por un importe distinto (${ev.amountCents} céntimos, evento ${ev.eventId}).`.trim() },
      req,
      overrideAccess: true,
      context: { system: true },
    })
    outcome = 'amount-mismatch'
  } else {
    // Si entre el carrito y el pago se agotó el stock, el pedido queda pagado
    // con una incidencia: operaciones decide (esperar reposición o reembolsar).
    const shortages: string[] = []
    for (const line of order.lines ?? []) {
      const productId = typeof line.product === 'object' ? line.product.id : line.product
      if ((await available(payload, productId, req, order.id)) < line.quantity) shortages.push(line.productName)
    }
    await payload.update({
      collection: 'orders',
      id: order.id,
      data: {
        status: 'paid',
        payment: { provider: ev.provider, status: 'succeeded', reference: ev.eventId, paidAt: new Date().toISOString() },
        ...(shortages.length ? { incidents: `${order.incidents ?? ''}\nStock insuficiente al confirmar el pago: ${shortages.join(', ')}.`.trim() } : {}),
      },
      req,
      overrideAccess: true,
      context: { system: true },
    })
    outcome = 'paid'
  }

  await payload.update({ collection: 'payment-events', id: event.id, data: { outcome }, req, overrideAccess: true })
  return outcome
}

/** Pago simulado para la demo. El identificador fijo hace que repetirlo no cobre dos veces. */
export async function simulatePayment(payload: Payload, orderId: string | number, req?: PayloadRequest) {
  const order = await payload.findByID({ collection: 'orders', id: orderId, depth: 0, req, overrideAccess: true })
  return recordPaymentEvent(
    payload,
    { provider: 'simulated', eventId: `sim_${order.id}`, type: 'payment.succeeded', orderId: order.id, amountCents: order.totals?.totalCents ?? 0 },
    req,
  )
}
