import type { AccessResult, CollectionConfig } from 'payload'

import { hasRole, isCustomer, nobody } from '@/access'

/** Consentimientos y versiones. Se revocan; no se borran. */
export const Consents: CollectionConfig = {
  slug: 'consents',
  labels: { singular: 'Consentimiento', plural: 'Consentimientos' },
  admin: { group: 'Clientes', useAsTitle: 'kind', defaultColumns: ['customer', 'kind', 'version', 'grantedAt', 'revokedAt'] },
  access: {
    read: ({ req: { user } }): AccessResult => (isCustomer(user) ? { customer: { equals: user.id } } : hasRole(user, 'admin')),
    create: ({ req: { user } }) => isCustomer(user),
    update: ({ req: { user } }): AccessResult => (isCustomer(user) ? { customer: { equals: user.id } } : false),
    delete: nobody,
  },
  hooks: {
    beforeChange: [
      ({ data, req, operation }) => {
        if (isCustomer(req.user)) data.customer = req.user.id
        if (operation === 'create') data.grantedAt = new Date().toISOString()
        return data
      },
    ],
  },
  fields: [
    { name: 'customer', label: 'Cliente', type: 'relationship', relationTo: 'customers', required: true },
    {
      name: 'kind',
      label: 'Tipo',
      type: 'select',
      required: true,
      options: [
        { label: 'Condiciones de venta y del servicio', value: 'terms' },
        { label: 'Declaración de privacidad', value: 'privacy' },
        { label: 'Tratamiento de datos de seguimiento (plan, tomas, revisiones)', value: 'tracking-data' },
      ],
    },
    { name: 'version', label: 'Versión del texto', type: 'text', required: true },
    { name: 'grantedAt', label: 'Otorgado el', type: 'date', admin: { readOnly: true } },
    { name: 'revokedAt', label: 'Revocado el', type: 'date' },
  ],
}
