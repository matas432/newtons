import { APIError, type CollectionBeforeChangeHook, type CollectionConfig } from 'payload'

import { healthData, healthDataRead, idOf, isCustomer, isStaffUser, nobody } from '@/access'
import { inheritFrom } from '@/hooks/careContext'

/**
 * «Tengo una duda o molestia». No promete vigilancia continua ni respuesta de
 * urgencias (Libro 2, n.º 26): la interfaz debe decirlo claramente.
 */
const contextWithoutPlanItem: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  if (operation !== 'create' || data.planItem != null) return data
  if (!isCustomer(req.user)) throw new APIError('Falta la línea del plan.', 400, undefined, true)
  const link = await req.payload.find({
    collection: 'customer-links',
    where: { and: [{ customer: { equals: req.user.id } }, { status: { equals: 'active' } }] },
    limit: 1,
    depth: 0,
    req,
    overrideAccess: true,
  })
  if (!link.docs.length) throw new APIError('No tienes una droguería vinculada.', 400, undefined, true)
  data.customer = req.user.id
  data.chain = idOf(link.docs[0].chain)
  data.store = idOf(link.docs[0].store)
  return data
}

const stamp: CollectionBeforeChangeHook = ({ data, operation, originalDoc, req }) => {
  if (operation === 'create') data.reportedAt = new Date().toISOString()
  if (isStaffUser(req.user) && data.status === 'seen' && originalDoc?.status !== 'seen') data.seenBy = req.user.id
  return data
}

export const SymptomReports: CollectionConfig = {
  slug: 'symptom-reports',
  labels: { singular: 'Duda o molestia', plural: 'Dudas y molestias' },
  admin: { group: 'Clientes y planes', useAsTitle: 'id', defaultColumns: ['reportedAt', 'customer', 'kind', 'severity', 'status'] },
  access: {
    read: healthDataRead(),
    create: ({ req: { user } }) => isCustomer(user),
    update: healthData('view-shared-data'),
    delete: nobody,
  },
  hooks: { beforeChange: [inheritFrom('planItem', 'plan-items'), contextWithoutPlanItem, stamp] },
  fields: [
    { name: 'planItem', label: 'Línea del plan (si aplica)', type: 'relationship', relationTo: 'plan-items' },
    {
      type: 'row',
      fields: [
        { name: 'customer', label: 'Cliente', type: 'relationship', relationTo: 'customers', required: true, index: true, admin: { readOnly: true } },
        { name: 'chain', label: 'Cadena', type: 'relationship', relationTo: 'chains', required: true, index: true, admin: { readOnly: true } },
        { name: 'store', label: 'Establecimiento', type: 'relationship', relationTo: 'stores', admin: { readOnly: true } },
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
        {
          name: 'status',
          label: 'Estado',
          type: 'select',
          required: true,
          defaultValue: 'open',
          options: [
            { label: 'Sin ver', value: 'open' },
            { label: 'Vista por la droguería', value: 'seen' },
          ],
        },
      ],
    },
    { name: 'description', label: 'Descripción', type: 'textarea', required: true },
    { name: 'reportedAt', label: 'Comunicada el', type: 'date', admin: { readOnly: true } },
    { name: 'seenBy', label: 'Vista por', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
  ],
}
