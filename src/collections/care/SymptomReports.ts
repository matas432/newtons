import type { CollectionConfig } from 'payload'

import { customersOnly, nobody, ownDataOnly } from '@/access'
import { inheritCustomer, setOwner } from '@/hooks/careContext'

/**
 * «Registrar una duda o molestia». Queda en el historial del cliente para
 * preparar una revisión o una consulta. No hay monitorización permanente ni
 * atención de urgencias desde la app (Libro 1 v2.0, cap. 7): la interfaz debe
 * decirlo claramente.
 */
export const SymptomReports: CollectionConfig = {
  slug: 'symptom-reports',
  labels: { singular: 'Duda o molestia', plural: 'Dudas y molestias' },
  admin: { group: 'Seguimiento del cliente', useAsTitle: 'id', defaultColumns: ['reportedAt', 'kind', 'severity'] },
  access: { read: ownDataOnly(), create: customersOnly, update: ownDataOnly(), delete: nobody },
  hooks: {
    beforeChange: [
      setOwner,
      inheritCustomer('planItem', 'plan-items'),
      ({ data, operation }) => {
        if (operation === 'create') data.reportedAt = new Date().toISOString()
        return data
      },
    ],
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'customer', label: 'Cliente', type: 'relationship', relationTo: 'customers', required: true, index: true },
        { name: 'planItem', label: 'Línea del plan (si aplica)', type: 'relationship', relationTo: 'plan-items' },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'kind',
          label: 'Tipo',
          type: 'select',
          required: true,
          options: [
            { label: 'Duda', value: 'question' },
            { label: 'Molestia', value: 'discomfort' },
            { label: 'Dificultad para seguir el plan', value: 'adherence' },
            { label: 'He dejado de tomarlo', value: 'stopped' },
          ],
        },
        {
          name: 'severity',
          label: 'Intensidad',
          type: 'select',
          options: [
            { label: 'Leve', value: 'mild' },
            { label: 'Moderada', value: 'moderate' },
            { label: 'Intensa', value: 'severe' },
          ],
        },
      ],
    },
    { name: 'description', label: 'Descripción', type: 'textarea', required: true },
    { name: 'reportedAt', label: 'Registrada el', type: 'date', admin: { readOnly: true } },
  ],
}
