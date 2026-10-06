import type { CollectionConfig } from 'payload'

import { anyone, chainAdminCreate, ownChain } from '@/access'
import { forceOwnChain } from '@/hooks/forceOwnChain'

export const Stores: CollectionConfig = {
  slug: 'stores',
  labels: { singular: 'Establecimiento', plural: 'Establecimientos' },
  admin: { group: 'Droguerías', useAsTitle: 'name', defaultColumns: ['name', 'chain', 'city'] },
  access: {
    read: anyone,
    create: chainAdminCreate,
    update: ownChain(),
    delete: ownChain(),
  },
  hooks: { beforeChange: [forceOwnChain] },
  fields: [
    { name: 'chain', label: 'Cadena', type: 'relationship', relationTo: 'chains', required: true, index: true },
    { name: 'name', label: 'Nombre', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        { name: 'street', label: 'Dirección', type: 'text' },
        { name: 'postalCode', label: 'Código postal', type: 'text' },
        { name: 'city', label: 'Localidad', type: 'text' },
      ],
    },
    { name: 'phone', label: 'Teléfono', type: 'text' },
  ],
}
