import type { CollectionConfig } from 'payload'

import { customersOnly, isCustomer, isEditorial, nobody } from '@/access'

/**
 * Archivos privados (fotos de etiquetas enviadas por clientes). A diferencia
 * de `media`, no son públicos: los ven su autor y el equipo editorial.
 */
export const PrivateFiles: CollectionConfig = {
  slug: 'private-files',
  labels: { singular: 'Archivo privado', plural: 'Archivos privados' },
  admin: { group: 'Sistema' },
  upload: { mimeTypes: ['image/*', 'application/pdf'] },
  access: {
    read: ({ req: { user } }) => (isCustomer(user) ? { owner: { equals: user.id } } : isEditorial(user)),
    create: customersOnly,
    update: nobody,
    delete: ({ req: { user } }) => (isCustomer(user) ? { owner: { equals: user.id } } : false),
  },
  hooks: {
    beforeChange: [
      ({ data, req, operation }) => {
        if (operation === 'create' && isCustomer(req.user)) data.owner = req.user.id
        return data
      },
    ],
  },
  fields: [{ name: 'owner', label: 'Cliente', type: 'relationship', relationTo: 'customers', access: { read: ({ req: { user } }) => isCustomer(user) } }],
}
