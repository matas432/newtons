import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'

import { nobody, ownDataOnly } from '@/access'
import { auditTrail } from '@/hooks/auditTrail'
import { inheritCustomer, serverControlled } from '@/hooks/careContext'
import { OBSERVATION_ANSWER_TYPES, REVIEW_OUTCOMES } from '@/lib/options'

/**
 * Revisión de una línea del plan. Se crea con las fechas del ciclo. El
 * cliente responde y registra su decisión; nada se renueva ni se compra
 * automáticamente, y las respuestas no demuestran causalidad.
 */
const workflow: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  if (data.answer?.questionAnswer && originalDoc?.status === 'pending') {
    data.status = 'answered'
    data.answer.answeredAt = new Date().toISOString()
  }
  if (data.outcome && data.outcome !== originalDoc?.outcome) {
    data.status = 'closed'
    data.closedAt = new Date().toISOString()
  }
  return data
}

export const Reviews: CollectionConfig = {
  slug: 'reviews',
  labels: { singular: 'Revisión', plural: 'Revisiones' },
  defaultSort: 'dueDate',
  admin: { group: 'Seguimiento del cliente', useAsTitle: 'dueDate', defaultColumns: ['dueDate', 'planItem', 'kind', 'status', 'outcome'] },
  access: { read: ownDataOnly(), create: nobody, update: ownDataOnly(), delete: nobody },
  hooks: {
    beforeChange: [inheritCustomer('planItem', 'plan-items'), serverControlled(['dueDate', 'kind', 'reviewQuestion', 'closedAt', 'planItem']), workflow],
    afterChange: [auditTrail],
  },
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
            { label: 'Respondida', value: 'answered' },
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
              label: 'Uso real',
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
        { name: 'outcome', label: 'Decisión del cliente', type: 'select', options: REVIEW_OUTCOMES },
        { name: 'closedAt', label: 'Cerrada el', type: 'date', admin: { readOnly: true } },
      ],
    },
  ],
}
