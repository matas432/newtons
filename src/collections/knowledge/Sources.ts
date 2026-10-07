import type { CollectionConfig } from 'payload'

import { anyone, editorial } from '@/access'

export const Sources: CollectionConfig = {
  slug: 'sources',
  labels: { singular: 'Fuente', plural: 'Fuentes' },
  admin: { group: 'Conocimiento', useAsTitle: 'title', defaultColumns: ['title', 'kind', 'year'] },
  access: { read: anyone, create: editorial, update: editorial, delete: editorial },
  fields: [
    { name: 'title', label: 'Título', type: 'text', required: true },
    {
      name: 'kind',
      label: 'Tipo',
      type: 'select',
      required: true,
      options: [
        { label: 'Estudio', value: 'study' },
        { label: 'Revisión / metaanálisis', value: 'review' },
        { label: 'Monografía (EMA, etc.)', value: 'monograph' },
        { label: 'Fuente institucional / regulatoria', value: 'regulatory' },
        { label: 'Documento interno', value: 'internal' },
        { label: 'Otra', value: 'other' },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'authors', label: 'Autores', type: 'text' },
        { name: 'year', label: 'Año', type: 'number' },
      ],
    },
    { name: 'publication', label: 'Publicación', type: 'text' },
    { name: 'url', label: 'URL o DOI', type: 'text' },
    { name: 'notes', label: 'Notas', type: 'textarea' },
  ],
}
