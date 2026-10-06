import type { CollectionConfig } from 'payload'

import { anyone, chainAdminCreate, ownChain } from '@/access'
import { forceOwnChain } from '@/hooks/forceOwnChain'

/**
 * Surtido de cada cadena sobre la base común de productos (Libro 2, n.º 9).
 * La cadena elige qué ofrece; no puede alterar la ficha ni la composición.
 */
export const Assortment: CollectionConfig = {
  slug: 'assortment',
  labels: { singular: 'Producto del surtido', plural: 'Surtido' },
  admin: { group: 'Droguerías', useAsTitle: 'id', defaultColumns: ['chain', 'product', 'active'] },
  access: {
    read: anyone,
    create: chainAdminCreate,
    update: ownChain(),
    delete: ownChain(),
  },
  indexes: [{ fields: ['chain', 'product'], unique: true }],
  hooks: { beforeChange: [forceOwnChain] },
  fields: [
    { name: 'chain', label: 'Cadena', type: 'relationship', relationTo: 'chains', required: true },
    { name: 'product', label: 'Producto', type: 'relationship', relationTo: 'products', required: true },
    { name: 'stores', label: 'Solo en estos establecimientos', type: 'relationship', relationTo: 'stores', hasMany: true, admin: { description: 'Vacío = toda la cadena.' } },
    { name: 'internalCode', label: 'Código interno de la cadena', type: 'text' },
    { name: 'active', label: 'Disponible', type: 'checkbox', defaultValue: true },
  ],
}
