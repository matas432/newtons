import type { CollectionConfig } from 'payload'

import { isOperations, isStaffUser, nobody } from '@/access'

/**
 * Libro de movimientos de stock: solo se añaden registros, nunca se editan ni
 * se borran. Una corrección es otro movimiento con su motivo.
 */
export const StockMovements: CollectionConfig = {
  slug: 'stock-movements',
  labels: { singular: 'Movimiento de stock', plural: 'Movimientos de stock' },
  admin: { group: 'Inventario', useAsTitle: 'kind', defaultColumns: ['createdAt', 'lot', 'kind', 'bucket', 'quantity', 'order', 'reason'] },
  access: {
    read: ({ req: { user } }) => isStaffUser(user),
    // Operaciones registra ajustes, mermas y liberaciones; el resto los crea el sistema.
    create: ({ req: { user } }) => isOperations(user),
    update: nobody,
    delete: nobody,
  },
  hooks: {
    beforeChange: [
      ({ data, req }) => {
        if (isStaffUser(req.user)) data.createdBy = req.user.id
        return data
      },
    ],
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'lot', label: 'Lote', type: 'relationship', relationTo: 'lots', required: true, index: true },
        { name: 'product', label: 'Producto', type: 'relationship', relationTo: 'products', required: true, index: true },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'kind',
          label: 'Tipo',
          type: 'select',
          required: true,
          options: [
            { label: 'Recepción', value: 'receipt' },
            { label: 'Salida en pedido', value: 'shipment' },
            { label: 'Devolución (retenida)', value: 'return' },
            { label: 'Liberación de retenido a vendible', value: 'release' },
            { label: 'Retención', value: 'hold' },
            { label: 'Merma o destrucción', value: 'write-off' },
            { label: 'Ajuste de inventario', value: 'adjustment' },
          ],
        },
        {
          name: 'bucket',
          label: 'Cajón',
          type: 'select',
          required: true,
          defaultValue: 'sellable',
          options: [
            { label: 'Vendible', value: 'sellable' },
            { label: 'Retenido', value: 'held' },
          ],
        },
        { name: 'quantity', label: 'Unidades (+ entra, − sale)', type: 'number', required: true },
      ],
    },
    { name: 'order', label: 'Pedido', type: 'relationship', relationTo: 'orders' },
    { name: 'reason', label: 'Motivo', type: 'text', required: true },
    { name: 'createdBy', label: 'Registrado por', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
  ],
}
