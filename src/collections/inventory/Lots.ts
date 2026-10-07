import { APIError, type CollectionAfterChangeHook, type CollectionBeforeChangeHook, type CollectionConfig } from 'payload'

import { hasRole, idOf, isOperations, isStaffUser, mustId } from '@/access'
import { auditTrail } from '@/hooks/auditTrail'

/**
 * Lote recibido de un proveedor. Cada lote puede rastrearse hasta proveedor y
 * pedidos (Libro 1 v2.0, cap. 14). Las cantidades no se editan: salen del
 * libro de movimientos (`stock-movements`).
 */
const validate: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  if (operation === 'create') {
    if (!data.quantityReceived || data.quantityReceived <= 0) {
      throw new APIError('Indica cuántas unidades se recibieron.', 400, undefined, true)
    }
    const product = await req.payload.findByID({ collection: 'products', id: idOf(data.product)!, depth: 0, req, overrideAccess: true })
    data.formulation ??= idOf(product.currentFormulation)
    if (!data.formulation) throw new APIError('El producto no tiene una formulación verificada.', 400, undefined, true)
    data.supplier ??= idOf(product.supplier)
  }
  return data
}

const recordReceipt: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (operation !== 'create') return doc
  await req.payload.create({
    collection: 'stock-movements',
    data: {
      lot: doc.id,
      product: mustId(doc.product),
      kind: 'receipt',
      bucket: doc.status === 'held' ? 'held' : 'sellable',
      quantity: doc.quantityReceived,
      reason: 'Recepción del lote',
    },
    req,
    overrideAccess: true,
  })
  return doc
}

export const Lots: CollectionConfig = {
  slug: 'lots',
  labels: { singular: 'Lote', plural: 'Lotes' },
  admin: { group: 'Inventario', useAsTitle: 'lotNumber', defaultColumns: ['lotNumber', 'product', 'expiryDate', 'status', 'receivedOn'] },
  access: {
    read: ({ req: { user } }) => isStaffUser(user),
    create: ({ req: { user } }) => isOperations(user),
    update: ({ req: { user } }) => isOperations(user),
    delete: ({ req: { user } }) => hasRole(user, 'admin'),
  },
  hooks: { beforeChange: [validate], afterChange: [recordReceipt, auditTrail] },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'product', label: 'Producto', type: 'relationship', relationTo: 'products', required: true, index: true },
        { name: 'lotNumber', label: 'Número de lote', type: 'text', required: true },
        { name: 'expiryDate', label: 'Fecha de caducidad (AAAA-MM-DD)', type: 'text', required: true, validate: (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) || 'Formato AAAA-MM-DD' },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'formulation', label: 'Formulación de este lote', type: 'relationship', relationTo: 'formulations', admin: { description: 'Por defecto, la vigente al recibirlo.' } },
        { name: 'supplier', label: 'Proveedor', type: 'relationship', relationTo: 'suppliers' },
        { name: 'receivedOn', label: 'Recibido el (AAAA-MM-DD)', type: 'text' },
      ],
    },
    {
      name: 'quantityReceived',
      label: 'Unidades recibidas',
      type: 'number',
      min: 1,
      access: { update: () => false },
      admin: { description: 'Solo al crear. Después, cualquier cambio de cantidad es un movimiento de stock.' },
    },
    { name: 'supplierDocument', label: 'Albarán o factura del proveedor', type: 'text' },
    { name: 'storageLocation', label: 'Ubicación', type: 'text' },
    {
      name: 'status',
      label: 'Estado',
      type: 'select',
      required: true,
      defaultValue: 'available',
      options: [
        { label: 'Disponible', value: 'available' },
        { label: 'Retenido (no se vende)', value: 'held' },
        { label: 'Retirado del mercado', value: 'recalled' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'statusNote', label: 'Motivo del estado', type: 'textarea', admin: { position: 'sidebar' } },
  ],
}
