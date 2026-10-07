import type { CollectionConfig } from 'payload'

import { admin, nobody } from '@/access'

/**
 * Eventos recibidos del proveedor de pago. El identificador único del evento
 * garantiza que un reintento no cobre ni confirme dos veces.
 */
export const PaymentEvents: CollectionConfig = {
  slug: 'payment-events',
  labels: { singular: 'Evento de pago', plural: 'Eventos de pago' },
  admin: { group: 'Pedidos', useAsTitle: 'eventId', defaultColumns: ['createdAt', 'provider', 'type', 'order', 'amountCents', 'outcome'] },
  access: { read: admin, create: nobody, update: nobody, delete: nobody },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'provider',
          label: 'Proveedor',
          type: 'select',
          required: true,
          options: [
            { label: 'Simulado (demo)', value: 'simulated' },
            { label: 'Stripe', value: 'stripe' },
            { label: 'Payrexx', value: 'payrexx' },
          ],
        },
        { name: 'eventId', label: 'Identificador del evento', type: 'text', required: true, unique: true, index: true },
        { name: 'type', label: 'Tipo', type: 'text', required: true },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'order', label: 'Pedido', type: 'relationship', relationTo: 'orders', required: true },
        { name: 'amountCents', label: 'Importe (céntimos)', type: 'number', required: true },
        { name: 'outcome', label: 'Resultado', type: 'text' },
      ],
    },
  ],
}
