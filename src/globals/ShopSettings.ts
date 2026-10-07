import type { GlobalConfig } from 'payload'

import { anyone, hasRole } from '@/access'

/** Ajustes de la tienda: envíos, vida útil mínima y textos de preparación. */
export const ShopSettings: GlobalConfig = {
  slug: 'shop-settings',
  label: 'Ajustes de la tienda',
  admin: { group: 'Pedidos' },
  access: { read: anyone, update: ({ req: { user } }) => hasRole(user, 'admin', 'operations') },
  fields: [
    {
      name: 'shippingOptions',
      label: 'Opciones de envío',
      type: 'array',
      minRows: 1,
      labels: { singular: 'Opción', plural: 'Opciones' },
      admin: { description: 'Se cobra el transporte de forma transparente; sin umbral gratuito hasta calcularlo (Libro 1 v2.0, cap. 11).' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'code', label: 'Código', type: 'text', required: true },
            { name: 'label', label: 'Nombre', type: 'text', required: true, localized: true },
            { name: 'price', label: 'Precio al cliente (CHF)', type: 'number', required: true, min: 0 },
            { name: 'maxWeightGrams', label: 'Peso máximo (g)', type: 'number' },
          ],
        },
        { name: 'deliveryNote', label: 'Plazo orientativo', type: 'text', localized: true },
      ],
    },
    { name: 'minShelfLifeDays', label: 'Vida útil mínima restante para vender (días)', type: 'number', required: true, defaultValue: 90 },
    { name: 'preparationNote', label: 'Plazo de preparación (texto)', type: 'text', localized: true },
    { name: 'shippingVatRate', label: 'IVA del envío (%)', type: 'number', admin: { description: 'Vacío = el del primer artículo. Confirmar con asesoría fiscal.' } },
  ],
}
