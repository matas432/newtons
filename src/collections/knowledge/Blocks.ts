import type { CollectionConfig } from 'payload'

import { anyone, editorial } from '@/access'
import { MEAL_RELATION } from '@/lib/options'

/**
 * Bloques del día (A — ayunas, …). La lista definitiva está pendiente
 * (Plantilla de ficha, pendiente n.º 1); por eso son datos editables.
 */
export const Blocks: CollectionConfig = {
  slug: 'blocks',
  labels: { singular: 'Bloque', plural: 'Bloques' },
  admin: { group: 'Conocimiento', useAsTitle: 'name', defaultColumns: ['code', 'name', 'defaultTime'] },
  access: { read: anyone, create: editorial, update: editorial, delete: editorial },
  defaultSort: 'order',
  fields: [
    { name: 'code', label: 'Código', type: 'text', required: true, unique: true },
    { name: 'name', label: 'Nombre', type: 'text', required: true, localized: true },
    { name: 'description', label: 'Descripción', type: 'textarea', localized: true },
    {
      type: 'row',
      fields: [
        { name: 'defaultTime', label: 'Hora por defecto (HH:MM)', type: 'text', required: true, validate: (v: unknown) => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)) || 'Formato HH:MM' },
        { name: 'mealRelation', label: 'Relación con las comidas', type: 'select', options: MEAL_RELATION },
        { name: 'order', label: 'Orden', type: 'number', required: true },
      ],
    },
    { name: 'provisional', label: 'Provisional (pendiente de definición)', type: 'checkbox', defaultValue: false },
  ],
}
