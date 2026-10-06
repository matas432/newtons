import { APIError, type CollectionBeforeChangeHook, type CollectionConfig } from 'payload'

import { healthDataRead, isCustomer, nobody } from '@/access'
import { inheritFrom } from '@/hooks/careContext'

/**
 * Registro de tomas. Libro 1, cap. 7: no responder a un recordatorio no
 * equivale a confirmar una toma. «Sin registro» es la ausencia de documento;
 * nunca se crea automáticamente un «tomado». Los registros se pueden corregir.
 */
const stamp: CollectionBeforeChangeHook = ({ data, operation, originalDoc }) => {
  if (operation === 'create') data.loggedAt = new Date().toISOString()
  if (operation === 'update' && originalDoc && (data.status !== originalDoc.status || data.servings !== originalDoc.servings)) {
    data.correctedAt = new Date().toISOString()
  }
  if (data.status === 'taken' && (data.servings == null || data.servings <= 0)) {
    throw new APIError('Indica cuántas unidades se tomaron.', 400, undefined, true)
  }
  return data
}

export const IntakeLogs: CollectionConfig = {
  slug: 'intake-logs',
  labels: { singular: 'Registro de toma', plural: 'Registro de tomas' },
  admin: { group: 'Clientes y planes', useAsTitle: 'date', defaultColumns: ['date', 'planItem', 'status', 'servings'] },
  access: {
    read: healthDataRead(),
    create: ({ req: { user } }) => isCustomer(user),
    update: ({ req: { user } }) => (isCustomer(user) ? { customer: { equals: user.id } } : false),
    delete: nobody,
  },
  hooks: { beforeChange: [inheritFrom('planItem', 'plan-items'), stamp] },
  fields: [
    { name: 'planItem', label: 'Línea del plan', type: 'relationship', relationTo: 'plan-items', required: true, index: true },
    {
      type: 'row',
      fields: [
        { name: 'customer', label: 'Cliente', type: 'relationship', relationTo: 'customers', index: true, admin: { readOnly: true } },
        { name: 'chain', label: 'Cadena', type: 'relationship', relationTo: 'chains', index: true, admin: { readOnly: true } },
        { name: 'store', label: 'Establecimiento', type: 'relationship', relationTo: 'stores', admin: { readOnly: true } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'date', label: 'Día', type: 'text', required: true, index: true, validate: (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) || 'Formato AAAA-MM-DD' },
        { name: 'block', label: 'Bloque', type: 'relationship', relationTo: 'blocks' },
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
