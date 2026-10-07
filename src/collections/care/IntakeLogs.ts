import { APIError, type CollectionBeforeChangeHook, type CollectionConfig } from 'payload'

import { customersOnly, nobody, ownDataOnly } from '@/access'
import { inheritCustomer } from '@/hooks/careContext'

/**
 * Registro de tomas. Un recordatorio no respondido no equivale a una toma:
 * «sin registro» es la ausencia de documento y nunca se crea un «tomado»
 * automáticamente. Los registros se pueden corregir; cancelar o devolver un
 * pedido no los borra (Libro 1 v2.0, cap. 15).
 */
const stamp: CollectionBeforeChangeHook = ({ data, operation, originalDoc }) => {
  if (operation === 'create') data.loggedAt = new Date().toISOString()
  if (operation === 'update' && originalDoc && (data.status !== originalDoc.status || data.servings !== originalDoc.servings)) {
    data.correctedAt = new Date().toISOString()
  }
  if (data.status === 'taken' && (data.servings == null || data.servings <= 0)) {
    throw new APIError('Indica cuántas unidades tomaste.', 400, undefined, true)
  }
  return data
}

export const IntakeLogs: CollectionConfig = {
  slug: 'intake-logs',
  labels: { singular: 'Registro de toma', plural: 'Registro de tomas' },
  admin: { group: 'Seguimiento del cliente', useAsTitle: 'date', defaultColumns: ['date', 'planItem', 'intakeIndex', 'status', 'servings'] },
  access: { read: ownDataOnly(), create: customersOnly, update: ownDataOnly(), delete: nobody },
  hooks: { beforeChange: [inheritCustomer('planItem', 'plan-items'), stamp] },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'planItem', label: 'Línea del plan', type: 'relationship', relationTo: 'plan-items', required: true, index: true },
        { name: 'customer', label: 'Cliente', type: 'relationship', relationTo: 'customers', index: true, admin: { readOnly: true } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'date', label: 'Día', type: 'text', required: true, index: true, validate: (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) || 'Formato AAAA-MM-DD' },
        { name: 'intakeIndex', label: 'Toma n.º (de la línea)', type: 'number', defaultValue: 0, min: 0 },
        {
          name: 'status',
          label: 'Estado',
          type: 'select',
          required: true,
          options: [
            { label: 'Tomado', value: 'taken' },
            { label: 'Omitido', value: 'skipped' },
            { label: 'Pospuesto', value: 'postponed' },
          ],
        },
        { name: 'servings', label: 'Unidades', type: 'number', min: 0 },
      ],
    },
    { name: 'note', label: 'Nota', type: 'textarea' },
    { name: 'loggedAt', label: 'Registrado el', type: 'date', admin: { readOnly: true } },
    { name: 'correctedAt', label: 'Corregido el', type: 'date', admin: { readOnly: true } },
  ],
}
