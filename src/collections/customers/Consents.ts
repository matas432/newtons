import type { CollectionConfig } from 'payload'

import { hasRole, isCustomer, nobody } from '@/access'

/** Consentimientos y versiones (Libro 1, cap. 11). Se revocan; no se borran. */
export const Consents: CollectionConfig = {
  slug: 'consents',
  labels: { singular: 'Consentimiento', plural: 'Consentimientos' },
  admin: { group: 'Clientes y planes', useAsTitle: 'kind', defaultColumns: ['customer', 'kind', 'version', 'grantedAt', 'revokedAt'] },
  access: {
    read: ({ req: { user } }) => (isCustomer(user) ? { customer: { equals: user.id } } : hasRole(user, 'newtons-admin')),
    create: ({ req: { user } }) => isCustomer(user),
    update: ({ req: { user } }) => (isCustomer(user) ? { customer: { equals: user.id } } : false),
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
        { label: 'Condiciones del servicio', value: 'terms' },
        { label: 'Información de privacidad', value: 'privacy' },
        { label: 'Compartir datos con la droguería', value: 'share-with-chain' },
      ],
    },
    { name: 'chain', label: 'Cadena (si aplica)', type: 'relationship', relationTo: 'chains' },
    { name: 'version', label: 'Versión del texto', type: 'text', required: true },
    { name: 'grantedAt', label: 'Otorgado el', type: 'date', admin: { readOnly: true } },
    { name: 'revokedAt', label: 'Revocado el', type: 'date' },
  ],
}
