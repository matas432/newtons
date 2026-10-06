import type { CollectionConfig } from 'payload'

import { anyone, editorial } from '@/access'

/**
 * Plantillas de ritmo MAT. Son plantillas configurables, no pautas universales
 * (Libro 2, n.º 25): cada plan copia las duraciones y puede ajustarlas.
 */
export const Rhythms: CollectionConfig = {
  slug: 'rhythms',
  labels: { singular: 'Ritmo', plural: 'Ritmos' },
  admin: { group: 'Conocimiento', useAsTitle: 'name', defaultColumns: ['code', 'name', 'useWeeks', 'pauseWeeks'] },
  access: { read: anyone, create: editorial, update: editorial, delete: editorial },
  fields: [
    { name: 'code', label: 'Código', type: 'text', required: true, unique: true },
    { name: 'name', label: 'Nombre', type: 'text', required: true, localized: true },
    { name: 'description', label: 'Descripción', type: 'textarea', localized: true },
    {
      name: 'continuous',
      label: 'Uso continuo (sin pausa fija)',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      type: 'row',
      fields: [
        { name: 'useWeeks', label: 'Semanas de uso u observación', type: 'number', min: 1, admin: { condition: (data) => !data?.continuous } },
        { name: 'pauseWeeks', label: 'Semanas de pausa/revisión', type: 'number', min: 0, admin: { condition: (data) => !data?.continuous } },
        { name: 'reviewEveryWeeks', label: 'Revisión cada (semanas)', type: 'number', min: 1, admin: { condition: (data) => !!data?.continuous } },
      ],
    },
    {
      name: 'pauseIsMinimum',
      label: 'La pausa es un mínimo antes de reconsiderar',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Cosecha: «al menos doce semanas de pausa».' },
    },
    {
      name: 'allowsSelectiveUse',
      label: 'Admite uso selectivo (no diario)',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Cultivo puede incluir uso ante circunstancias definidas.' },
    },
  ],
}
