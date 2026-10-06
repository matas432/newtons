import type { CollectionConfig } from 'payload'

import { anyone, hasRole, isEditorial } from '@/access'

export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Archivo', plural: 'Archivos' },
  admin: { group: 'Sistema' },
  access: {
    read: anyone,
    create: ({ req: { user } }) => isEditorial(user) || hasRole(user, 'chain-admin'),
    update: ({ req: { user } }) => isEditorial(user) || hasRole(user, 'chain-admin'),
    delete: ({ req: { user } }) => isEditorial(user),
  },
  fields: [{ name: 'alt', label: 'Texto alternativo', type: 'text', required: true }],
  upload: true,
}
