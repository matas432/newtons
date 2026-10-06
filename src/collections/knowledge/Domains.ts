import type { CollectionConfig } from 'payload'

import { anyone, editorial } from '@/access'

/** Los siete dominios funcionales MAT (Libro 1, cap. 5; Libro 2, n.º 19). */
export const Domains: CollectionConfig = {
  slug: 'domains',
  labels: { singular: 'Dominio', plural: 'Dominios' },
  admin: { group: 'Conocimiento', useAsTitle: 'clientName', defaultColumns: ['code', 'clientName', 'technicalName'] },
  access: { read: anyone, create: editorial, update: editorial, delete: editorial },
  defaultSort: 'order',
  fields: [
    { name: 'code', label: 'Código', type: 'text', required: true, unique: true, admin: { description: 'DF-1 … DF-7. No cambia aunque cambien los nombres.' } },
    { name: 'clientName', label: 'Nombre para el cliente', type: 'text', required: true, localized: true },
    { name: 'technicalName', label: 'Dominio técnico MAT', type: 'text', required: true, localized: true },
    { name: 'description', label: 'Área que organiza', type: 'textarea', localized: true },
    { name: 'order', label: 'Orden', type: 'number', required: true },
  ],
}
