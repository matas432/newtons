import {
  addDataAndFileToRequest,
  APIError,
  type CollectionAfterChangeHook,
  type CollectionBeforeChangeHook,
  type CollectionConfig,
  type Endpoint,
} from 'payload'

import { hasRole, idOf, isCustomer, isOperations, mustId, nobody } from '@/access'
import { createOrder } from '@/commerce/checkout'
import { simulatePayment } from '@/commerce/payments'
import { pickForOrder } from '@/commerce/stock'
import { auditTrail } from '@/hooks/auditTrail'

/**
 * Pedido (Libro 1 v2.0, cap. 9). Un pedido no es una pauta: pagarlo o
 * recibirlo no crea un plan ni inicia un ciclo. Al enviarlo solo se *sugiere*
 * añadir los productos a «Mis productos».
 */

type Status = 'pending-payment' | 'paid' | 'packed' | 'shipped' | 'delivered' | 'cancelled' | 'returned'

/** Transiciones que puede hacer el equipo. «Pagado» solo lo fija un evento de pago. */
const STAFF_TRANSITIONS: Record<Status, Status[]> = {
  'pending-payment': ['cancelled'],
  paid: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
  returned: [],
}

const FROZEN_AFTER_CREATE = ['orderNumber', 'customer', 'email', 'lines', 'totals', 'shippingMethod', 'payment'] as const

const guard: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req, context }) => {
  if (operation !== 'update' || context?.system) return data
  // Una modificación del catálogo o del panel no reescribe una compra.
  for (const f of FROZEN_AFTER_CREATE) data[f] = originalDoc[f]

  const from = originalDoc.status as Status
  const to = (data.status ?? from) as Status
  if (from !== to && !STAFF_TRANSITIONS[from]?.includes(to)) {
    throw new APIError(`No se puede pasar de «${from}» a «${to}».`, 400, undefined, true)
  }

  if (to === 'packed' && from !== 'packed') {
    // Asignar el lote real al empaquetar (FEFO; nunca retenidos ni caducados).
    data.lines = []
    for (const line of originalDoc.lines ?? []) {
      const picks = await pickForOrder(req.payload, idOf(line.product)!, line.quantity, req).catch((err) => {
        throw new APIError(`${line.productName}: ${err.message}`, 409, undefined, true)
      })
      data.lines.push({ ...line, lots: picks.map((p) => ({ lot: p.lotId, quantity: p.quantity })) })
    }
  }
  if (to === 'shipped' && from !== 'shipped') {
    // Crear la etiqueta no equivale a haber enviado.
    if (!data.shipment?.trackingNumber || !data.shipment?.depositedOn) {
      throw new APIError('Para marcarlo como enviado hacen falta el número de seguimiento y la fecha de depósito.', 400, undefined, true)
    }
  }
  if (to === 'cancelled' && from !== 'pending-payment' && !data.cancellationReason) {
    throw new APIError('Indica el motivo de la cancelación (y registra el reembolso).', 400, undefined, true)
  }

  // Devoluciones: se aceptan nuevas filas; las procesadas no se tocan.
  const before = originalDoc.returns ?? []
  data.returns = [...before, ...(data.returns ?? []).slice(before.length)]
  return data
}

const sideEffects: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, req }) => {
  if (operation !== 'update') return doc
  const { payload } = req
  const from = previousDoc?.status as Status
  const to = doc.status as Status

  if (to === 'packed' && from !== 'packed') {
    for (const line of doc.lines ?? []) {
      for (const pick of line.lots ?? []) {
        await payload.create({
          collection: 'stock-movements',
          data: { lot: mustId(pick.lot), product: mustId(line.product), kind: 'shipment', bucket: 'sellable', quantity: -pick.quantity, order: doc.id, reason: `Pedido ${doc.orderNumber}` },
          req,
          overrideAccess: true,
        })
      }
    }
  }

  if (to === 'cancelled' && from === 'packed') {
    // Cancelado tras empaquetar pero sin enviar: las unidades no han salido.
    for (const line of doc.lines ?? []) {
      for (const pick of line.lots ?? []) {
        await payload.create({
          collection: 'stock-movements',
          data: { lot: mustId(pick.lot), product: mustId(line.product), kind: 'adjustment', bucket: 'sellable', quantity: pick.quantity, order: doc.id, reason: `Pedido ${doc.orderNumber} cancelado antes del envío` },
          req,
          overrideAccess: true,
        })
      }
    }
  }

  if (to === 'shipped' && from !== 'shipped') {
    // Solo se sugiere: el cliente confirma qué va a registrar y cuándo empieza.
    for (const line of doc.lines ?? []) {
      const existing = await payload.find({
        collection: 'customer-products',
        where: { and: [{ customer: { equals: idOf(doc.customer) } }, { formulation: { equals: idOf(line.formulation) } }, { status: { not_equals: 'archived' } }] },
        limit: 1,
        req,
        overrideAccess: true,
      })
      if (existing.docs.length) continue
      await payload.create({
        collection: 'customer-products',
        context: { system: true },
        data: { customer: mustId(doc.customer), product: mustId(line.product), formulation: mustId(line.formulation), source: 'purchase', order: doc.id, status: 'suggested' },
        req,
        overrideAccess: true,
      })
    }
  }

  // Devoluciones nuevas: entran como retenidas y no vuelven solas al stock vendible.
  const pending = (doc.returns ?? []).filter((r: any) => !r.processed)
  if (pending.length) {
    for (const r of pending) {
      await payload.create({
        collection: 'stock-movements',
        data: { lot: mustId(r.lot), product: mustId(r.product), kind: 'return', bucket: 'held', quantity: r.quantity, order: doc.id, reason: `Devolución del pedido ${doc.orderNumber}: ${r.reason ?? ''}`.trim() },
        req,
        overrideAccess: true,
      })
    }
    await payload.update({
      collection: 'orders',
      id: doc.id,
      data: { status: 'returned', returns: (doc.returns ?? []).map((r: any) => ({ ...r, processed: true })) },
      req,
      overrideAccess: true,
      context: { system: true },
    })
  }
  return doc
}

// ---------------------------------------------------------------- endpoints

const checkoutEndpoint: Endpoint = {
  path: '/checkout',
  method: 'post',
  handler: async (req) => {
    if (!isCustomer(req.user)) return Response.json({ error: 'Inicia sesión para comprar.' }, { status: 401 })
    await addDataAndFileToRequest(req)
    const body = (req.data ?? {}) as any
    try {
      const order = await createOrder(req.payload, { ...body, customerId: req.user.id }, req)
      return Response.json({ order: { id: order.id, orderNumber: order.orderNumber, totals: order.totals, status: order.status } })
    } catch (err: any) {
      return Response.json({ error: err.message }, { status: err.status ?? 400 })
    }
  },
}

const simulatePaymentEndpoint: Endpoint = {
  path: '/:id/simulate-payment',
  method: 'post',
  handler: async (req) => {
    if (process.env.SIMULATED_PAYMENTS !== 'true') return Response.json({ error: 'Pagos simulados desactivados.' }, { status: 403 })
    if (!isCustomer(req.user)) return Response.json({ error: 'No autorizado.' }, { status: 401 })
    const id = req.routeParams?.id as string
    const order = await req.payload.findByID({ collection: 'orders', id, depth: 0, req, overrideAccess: true }).catch(() => null)
    if (!order || String(idOf(order.customer)) !== String(req.user.id)) return Response.json({ error: 'Pedido no encontrado.' }, { status: 404 })
    const outcome = await simulatePayment(req.payload, order.id, req)
    return Response.json({ outcome })
  },
}

// ---------------------------------------------------------------- colección

export const Orders: CollectionConfig = {
  slug: 'orders',
  labels: { singular: 'Pedido', plural: 'Pedidos' },
  admin: { group: 'Pedidos', useAsTitle: 'orderNumber', defaultColumns: ['orderNumber', 'createdAt', 'status', 'email'] },
  access: {
    read: ({ req: { user } }) => (isCustomer(user) ? { customer: { equals: user.id } } : hasRole(user, 'admin', 'operations', 'support')),
    // Los pedidos se crean solo por el proceso de compra.
    create: nobody,
    update: ({ req: { user } }) => isOperations(user),
    delete: nobody,
  },
  endpoints: [checkoutEndpoint, simulatePaymentEndpoint],
  hooks: { beforeChange: [guard], afterChange: [sideEffects, auditTrail] },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'orderNumber', label: 'Número', type: 'text', required: true, unique: true, admin: { readOnly: true } },
        { name: 'customer', label: 'Cliente', type: 'relationship', relationTo: 'customers', required: true, index: true, admin: { readOnly: true } },
        { name: 'email', label: 'Correo', type: 'email', admin: { readOnly: true } },
        {
          name: 'language',
          label: 'Idioma',
          type: 'select',
          options: [
            { label: 'Deutsch', value: 'de' },
            { label: 'English', value: 'en' },
          ],
          admin: { readOnly: true },
        },
      ],
    },
    {
      name: 'lines',
      label: 'Líneas',
      type: 'array',
      minRows: 1,
      labels: { singular: 'Línea', plural: 'Líneas' },
      admin: { readOnly: true, description: 'Producto, versión de composición y precio en el momento de la compra.' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'product', label: 'Producto', type: 'relationship', relationTo: 'products', required: true },
            { name: 'formulation', label: 'Composición (versión)', type: 'relationship', relationTo: 'formulations', required: true },
            { name: 'productName', label: 'Nombre en la compra', type: 'text', required: true },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'quantity', label: 'Unidades', type: 'number', required: true, min: 1 },
            { name: 'unitPriceCents', label: 'Precio unitario (céntimos)', type: 'number', required: true },
            { name: 'vatRate', label: 'IVA (%)', type: 'number' },
          ],
        },
        {
          name: 'lots',
          label: 'Lotes enviados',
          type: 'array',
          fields: [
            {
              type: 'row',
              fields: [
                { name: 'lot', label: 'Lote', type: 'relationship', relationTo: 'lots', required: true },
                { name: 'quantity', label: 'Unidades', type: 'number', required: true },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'totals',
      label: 'Importes (céntimos, IVA incluido)',
      type: 'group',
      admin: { readOnly: true },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'subtotalCents', label: 'Productos', type: 'number' },
            { name: 'shippingCents', label: 'Envío', type: 'number' },
            { name: 'vatCents', label: 'IVA contenido', type: 'number' },
            { name: 'totalCents', label: 'Total', type: 'number' },
          ],
        },
      ],
    },
    {
      name: 'shippingAddress',
      label: 'Dirección de entrega',
      type: 'group',
      fields: [
        { name: 'name', label: 'Destinatario', type: 'text', required: true },
        {
          type: 'row',
          fields: [
            { name: 'street', label: 'Calle y número', type: 'text', required: true },
            { name: 'addressLine2', label: 'Complemento', type: 'text' },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'postalCode', label: 'Código postal', type: 'text', required: true },
            { name: 'city', label: 'Localidad', type: 'text', required: true },
            { name: 'country', label: 'País', type: 'text', defaultValue: 'CH' },
          ],
        },
      ],
    },
    {
      name: 'shippingMethod',
      label: 'Envío elegido',
      type: 'group',
      admin: { readOnly: true },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'code', label: 'Código', type: 'text' },
            { name: 'label', label: 'Nombre', type: 'text' },
            { name: 'priceCents', label: 'Precio (céntimos)', type: 'number' },
          ],
        },
      ],
    },
    {
      name: 'payment',
      label: 'Pago',
      type: 'group',
      admin: { readOnly: true },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'provider',
              label: 'Proveedor',
              type: 'select',
              options: [
                { label: 'Simulado (demo)', value: 'simulated' },
                { label: 'Stripe', value: 'stripe' },
                { label: 'Payrexx', value: 'payrexx' },
              ],
            },
            {
              name: 'status',
              label: 'Estado',
              type: 'select',
              defaultValue: 'pending',
              options: [
                { label: 'Pendiente', value: 'pending' },
                { label: 'Cobrado', value: 'succeeded' },
                { label: 'Fallido', value: 'failed' },
              ],
            },
            { name: 'reference', label: 'Referencia', type: 'text' },
            { name: 'paidAt', label: 'Cobrado el', type: 'date' },
          ],
        },
      ],
    },
    {
      name: 'shipment',
      label: 'Envío (Swiss Post)',
      type: 'group',
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'trackingNumber', label: 'Número de seguimiento', type: 'text' },
            { name: 'depositedOn', label: 'Depositado el (AAAA-MM-DD)', type: 'text' },
            { name: 'weightGrams', label: 'Peso del paquete (g)', type: 'number' },
          ],
        },
        { name: 'deliveredOn', label: 'Entregado el (AAAA-MM-DD)', type: 'text' },
      ],
    },
    {
      name: 'returns',
      label: 'Devoluciones',
      type: 'array',
      labels: { singular: 'Devolución', plural: 'Devoluciones' },
      admin: { description: 'Las unidades devueltas entran como retenidas. Devolver no borra el historial de uso del cliente.' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'product', label: 'Producto', type: 'relationship', relationTo: 'products', required: true },
            { name: 'lot', label: 'Lote', type: 'relationship', relationTo: 'lots', required: true },
            { name: 'quantity', label: 'Unidades', type: 'number', required: true, min: 1 },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'reason', label: 'Motivo', type: 'text' },
            { name: 'refundCents', label: 'Reembolso (céntimos)', type: 'number' },
            { name: 'processed', label: 'Registrada en stock', type: 'checkbox', defaultValue: false, admin: { readOnly: true } },
          ],
        },
      ],
    },
    { name: 'cancellationReason', label: 'Motivo de cancelación y reembolso', type: 'textarea' },
    { name: 'incidents', label: 'Incidencias', type: 'textarea' },
    {
      name: 'status',
      label: 'Estado',
      type: 'select',
      required: true,
      defaultValue: 'pending-payment',
      options: [
        { label: 'Pendiente de pago', value: 'pending-payment' },
        { label: 'Pagado', value: 'paid' },
        { label: 'Empaquetado (lotes asignados)', value: 'packed' },
        { label: 'Enviado', value: 'shipped' },
        { label: 'Entregado', value: 'delivered' },
        { label: 'Cancelado', value: 'cancelled' },
        { label: 'Con devolución', value: 'returned' },
      ],
      admin: { position: 'sidebar' },
    },
  ],
}
