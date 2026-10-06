import { APIError, type CollectionBeforeChangeHook, type CollectionConfig } from 'payload'

import { hasPermission, healthData, healthDataRead, isCustomer, isStaffUser, nobody } from '@/access'
import { auditTrail } from '@/hooks/auditTrail'
import { customerMayOnlyChange, inheritFrom } from '@/hooks/careContext'
import { OBSERVATION_ANSWER_TYPES, REVIEW_OUTCOMES } from '@/lib/options'

/**
 * Revisión de una línea del plan. El cliente responde primero en la app; el
 * profesional registra la decisión (Libro 2, n.º 24). La revisión no renueva
 * nada automáticamente y no demuestra causalidad.
 */
const workflow: CollectionBeforeChangeHook = ({ data, originalDoc, req }) => {
  const user = req.user
  if (isCustomer(user) && data.answer && originalDoc?.status === 'pending') {
    data.status = 'answered'
    data.answer.answeredAt = new Date().toISOString()
  }
  const decides = data.outcome && data.outcome !== originalDoc?.outcome
  if (decides) {
    if (!hasPermission(user, 'confirm-plans')) {
      throw new APIError('Solo un profesional autorizado registra la decisión.', 403, undefined, true)
    }
    if (isStaffUser(user)) data.decidedBy = user.id
    data.decidedAt = new Date().toISOString()
    data.status = 'closed'
  }
  return data
}

export const Reviews: CollectionConfig = {
  slug: 'reviews',
  labels: { singular: 'Revisión', plural: 'Revisiones' },
  admin: { group: 'Clientes y planes', useAsTitle: 'dueDate', defaultColumns: ['dueDate', 'planItem', 'kind', 'status', 'outcome'] },
  access: {
    read: healthDataRead(),
    create: ({ req: { user } }) => hasPermission(user, 'prepare-plans') || hasPermission(user, 'confirm-plans'),
    update: (args) => {
      const { user } = args.req
      if (isCustomer(user)) return { and: [{ customer: { equals: user.id } }, { status: { equals: 'pending' } }] }
      if (hasPermission(user, 'confirm-plans')) return healthData('confirm-plans')(args)
      return false
    },
    delete: nobody,
  },
  hooks: {
    beforeChange: [inheritFrom('planItem', 'plan-items'), customerMayOnlyChange(['answer', 'status']), workflow],
    afterChange: [auditTrail],
  },
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
        { name: 'dueDate', label: 'Fecha prevista', type: 'text', required: true, index: true },
        {
          name: 'kind',
          label: 'Tipo',
          type: 'select',
          required: true,
          options: [
            { label: 'Revisión periódica', value: 'periodic' },
            { label: 'Fin del periodo de uso', value: 'end-of-use' },
            { label: 'Fin de la pausa', value: 'end-of-pause' },
            { label: 'Extraordinaria', value: 'extra' },
          ],
        },
        {
          name: 'status',
          label: 'Estado',
          type: 'select',
          required: true,
          defaultValue: 'pending',
          options: [
            { label: 'Pendiente', value: 'pending' },
            { label: 'Respondida por el cliente', value: 'answered' },
            { label: 'Cerrada con decisión', value: 'closed' },
          ],
        },
      ],
    },
    { name: 'reviewQuestion', label: 'Pregunta de revisión', type: 'text' },
    {
      name: 'answer',
      label: 'Respuesta del cliente',
      type: 'group',
      fields: [
        { name: 'questionAnswer', label: 'Respuesta a la pregunta', type: 'textarea' },
        {
          name: 'observations',
          label: 'Observaciones',
          type: 'array',
          fields: [
            { name: 'text', label: 'Situación', type: 'text' },
            { name: 'answerType', label: 'Tipo', type: 'select', options: OBSERVATION_ANSWER_TYPES },
            { name: 'value', label: 'Respuesta', type: 'text' },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'tolerability',
              label: 'Tolerabilidad',
              type: 'select',
              options: [
                { label: 'Bien', value: 'good' },
                { label: 'Alguna molestia', value: 'some' },
                { label: 'Mal', value: 'poor' },
              ],
            },
            {
              name: 'adherence',
              label: 'Seguimiento del plan',
              type: 'select',
              options: [
                { label: 'Como estaba previsto', value: 'as-planned' },
                { label: 'En parte', value: 'partial' },
                { label: 'Lo dejé', value: 'stopped' },
              ],
            },
          ],
        },
        { name: 'perceivedChange', label: 'Cambios percibidos', type: 'textarea' },
        { name: 'answeredAt', label: 'Respondida el', type: 'date', admin: { readOnly: true } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'outcome', label: 'Decisión', type: 'select', options: REVIEW_OUTCOMES },
        { name: 'decidedBy', label: 'Decidida por', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
        { name: 'decidedAt', label: 'Decidida el', type: 'date', admin: { readOnly: true } },
      ],
    },
    { name: 'professionalNotes', label: 'Notas profesionales', type: 'textarea' },
  ],
}
