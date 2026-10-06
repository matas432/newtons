import { APIError, type CollectionBeforeChangeHook, type CollectionConfig } from 'payload'

import { hasPermission, healthData, healthDataRead, idOf, isCustomer, nobody } from '@/access'
import { auditDelete, auditTrail } from '@/hooks/auditTrail'
import { customerMayOnlyChange, inheritFrom, requireChangeReason } from '@/hooks/careContext'
import { OBSERVATION_ANSWER_TYPES, WEEKDAYS } from '@/lib/options'

/**
 * Una línea del plan: un producto, cantidad, bloque, calendario y ciclo.
 * Al crearse copia las duraciones del ritmo y la pregunta de revisión de la
 * ficha; desde ese momento son del plan y no cambian si la ficha cambia.
 */
const snapshotDefaults: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  if (operation !== 'create') return data
  const { payload } = req

  if (data.product != null && data.formulation == null) {
    const product = await payload.findByID({ collection: 'products', id: idOf(data.product)!, depth: 0, req, overrideAccess: true })
    data.formulation = idOf(product.currentFormulation) ?? null
  }

  if (data.rhythm != null) {
    const rhythm = await payload.findByID({ collection: 'rhythms', id: idOf(data.rhythm)!, depth: 0, req, overrideAccess: true })
    data.continuous ??= rhythm.continuous
    data.useWeeks ??= rhythm.useWeeks
    data.pauseWeeks ??= rhythm.pauseWeeks
    data.reviewEveryWeeks ??= rhythm.reviewEveryWeeks
    data.pauseIsMinimum ??= rhythm.pauseIsMinimum
  }

  if (data.formulation != null && (!data.reviewQuestion || !data.observations?.length)) {
    const formulation = await payload.findByID({ collection: 'formulations', id: idOf(data.formulation)!, depth: 1, req, overrideAccess: true })
    const ingredient = formulation.composition?.[0]?.ingredient
    if (ingredient && typeof ingredient === 'object') {
      data.reviewQuestion ||= ingredient.reviewQuestion
      if (!data.observations?.length) {
        data.observations = (ingredient.observations ?? []).map((o) => ({ text: o.text, answerType: o.answerType }))
      }
      data.block ??= idOf(ingredient.block)
    }
  }
  return data
}

const stampDeclaredChanges: CollectionBeforeChangeHook = ({ data }) => {
  for (const row of data.declaredChanges ?? []) row.declaredAt ??= new Date().toISOString()
  return data
}

const validateSchedule: CollectionBeforeChangeHook = ({ data }) => {
  if (data.scheduleType === 'weekdays' && !data.weekdays?.length) {
    throw new APIError('Indica los días de la semana.', 400, undefined, true)
  }
  if (data.scheduleType === 'selective' && !data.selectiveCircumstances) {
    // Libro 2, n.º 22: nunca «cuando lo necesite» sin contexto.
    throw new APIError('El uso selectivo necesita circunstancias definidas.', 400, undefined, true)
  }
  if (!data.continuous && (data.useWeeks == null || data.pauseWeeks == null)) {
    throw new APIError('Indica las semanas de uso y de pausa, o marca uso continuo.', 400, undefined, true)
  }
  if (data.continuous && data.reviewEveryWeeks == null) {
    throw new APIError('El uso continuo necesita un intervalo de revisión.', 400, undefined, true)
  }
  return data
}

export const PlanItems: CollectionConfig = {
  slug: 'plan-items',
  labels: { singular: 'Línea del plan', plural: 'Líneas del plan' },
  admin: { group: 'Clientes y planes', useAsTitle: 'id', defaultColumns: ['plan', 'product', 'block', 'startDate', 'status'] },
  access: {
    read: healthDataRead(),
    create: ({ req: { user } }) => hasPermission(user, 'prepare-plans'),
    update: (args) => {
      const { user } = args.req
      if (isCustomer(user)) return { customer: { equals: user.id } }
      if (hasPermission(user, 'confirm-plans')) return healthData('confirm-plans')(args)
      if (hasPermission(user, 'prepare-plans')) return healthData('prepare-plans')(args)
      return false
    },
    delete: nobody,
  },
  hooks: {
    beforeChange: [
      inheritFrom('plan', 'plans'),
      customerMayOnlyChange(['reminderTime', 'declaredChanges']),
      snapshotDefaults,
      validateSchedule,
      requireChangeReason(async (doc, req) => {
        const plan = await req.payload.findByID({ collection: 'plans', id: idOf(doc.plan)!, depth: 0, req, overrideAccess: true })
        return plan.status === 'draft'
      }),
      stampDeclaredChanges,
    ],
    afterChange: [auditTrail],
    afterDelete: [auditDelete],
  },
  fields: [
    { name: 'plan', label: 'Plan', type: 'relationship', relationTo: 'plans', required: true, index: true },
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
        { name: 'product', label: 'Producto', type: 'relationship', relationTo: 'products', required: true },
        { name: 'formulation', label: 'Formulación', type: 'relationship', relationTo: 'formulations', admin: { description: 'Por defecto, la vigente al crear la línea. No cambia sola.' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'servingsPerIntake', label: 'Unidades por toma', type: 'number', required: true, min: 0, defaultValue: 1 },
        { name: 'block', label: 'Bloque', type: 'relationship', relationTo: 'blocks' },
        { name: 'reminderTime', label: 'Hora del recordatorio (HH:MM)', type: 'text', admin: { description: 'El cliente puede cambiarla; no altera la pauta.' } },
      ],
    },
    { name: 'instructions', label: 'Instrucciones', type: 'textarea' },
    {
      type: 'collapsible',
      label: 'Calendario',
      fields: [
        {
          name: 'scheduleType',
          label: 'Días de uso',
          type: 'select',
          required: true,
          defaultValue: 'daily',
          options: [
            { label: 'Todos los días', value: 'daily' },
            { label: 'Días de la semana', value: 'weekdays' },
            { label: 'Uso selectivo ante circunstancias definidas', value: 'selective' },
          ],
        },
        { name: 'weekdays', label: 'Días', type: 'select', hasMany: true, options: WEEKDAYS, admin: { condition: (d) => d?.scheduleType === 'weekdays' } },
        { name: 'selectiveCircumstances', label: 'Circunstancias definidas', type: 'textarea', admin: { condition: (d) => d?.scheduleType === 'selective' } },
        {
          type: 'row',
          admin: { condition: (d) => d?.scheduleType === 'selective' },
          fields: [
            { name: 'selectiveMaxPerDay', label: 'Máximo de tomas al día', type: 'number', min: 1 },
            { name: 'selectiveMinIntervalHours', label: 'Intervalo mínimo (horas)', type: 'number', min: 0 },
          ],
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Ciclo y ritmo',
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'rhythm', label: 'Ritmo', type: 'relationship', relationTo: 'rhythms' },
            { name: 'startDate', label: 'Fecha de inicio', type: 'text', required: true, validate: isoDate, admin: { description: 'AAAA-MM-DD' } },
          ],
        },
        { name: 'continuous', label: 'Uso continuo', type: 'checkbox' },
        {
          type: 'row',
          fields: [
            { name: 'useWeeks', label: 'Semanas de uso', type: 'number', min: 1 },
            { name: 'pauseWeeks', label: 'Semanas de pausa', type: 'number', min: 0 },
            { name: 'reviewEveryWeeks', label: 'Revisión cada (semanas)', type: 'number', min: 1 },
            { name: 'pauseIsMinimum', label: 'Pausa mínima', type: 'checkbox' },
          ],
        },
        {
          name: 'status',
          label: 'Estado de la línea',
          type: 'select',
          required: true,
          defaultValue: 'active',
          options: [
            { label: 'Activa', value: 'active' },
            { label: 'Pausada temporalmente', value: 'paused' },
            { label: 'Interrumpida', value: 'interrupted' },
            { label: 'Finalizada', value: 'ended' },
          ],
        },
        {
          name: 'pauses',
          label: 'Pausas temporales',
          type: 'array',
          admin: { description: 'Libro 2, n.º 23: una pausa no alarga ni reinicia el ciclo.' },
          fields: [
            {
              type: 'row',
              fields: [
                { name: 'from', label: 'Desde', type: 'text', required: true, validate: isoDate },
                { name: 'to', label: 'Hasta (incluido)', type: 'text', validate: isoDateOptional },
                { name: 'reason', label: 'Motivo', type: 'text' },
              ],
            },
          ],
        },
        { name: 'endedOn', label: 'Interrumpida o finalizada el', type: 'text', validate: isoDateOptional },
      ],
    },
    {
      type: 'collapsible',
      label: 'Revisión',
      fields: [
        { name: 'reviewQuestion', label: 'Pregunta de revisión', type: 'text' },
        {
          name: 'observations',
          label: 'Qué observar',
          type: 'array',
          maxRows: 3,
          fields: [
            { name: 'text', label: 'Situación', type: 'text', required: true },
            { name: 'answerType', label: 'Tipo de respuesta', type: 'select', defaultValue: 'scale', options: OBSERVATION_ANSWER_TYPES },
          ],
        },
      ],
    },
    {
      name: 'declaredChanges',
      label: 'Cambios declarados por el cliente',
      type: 'array',
      admin: { description: 'Libro 2, n.º 20: se guardan como «pendiente de revisión»; no cambian la pauta aprobada.' },
      fields: [
        { name: 'description', label: 'Qué ha cambiado', type: 'textarea', required: true },
        { name: 'declaredAt', label: 'Declarado el', type: 'date', admin: { readOnly: true } },
        {
          name: 'status',
          label: 'Estado',
          type: 'select',
          defaultValue: 'pending',
          options: [
            { label: 'Pendiente de revisión', value: 'pending' },
            { label: 'Revisado', value: 'reviewed' },
          ],
        },
      ],
    },
    { name: 'changeReason', label: 'Motivo del último cambio', type: 'text', admin: { position: 'sidebar' } },
  ],
}

function isoDate(value: unknown) {
  return (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) || 'Formato AAAA-MM-DD'
}
function isoDateOptional(value: unknown) {
  return value == null || value === '' || isoDate(value)
}
