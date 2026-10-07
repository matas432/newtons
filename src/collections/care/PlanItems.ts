import { APIError, type CollectionAfterChangeHook, type CollectionBeforeChangeHook, type CollectionConfig } from 'payload'

import { customersOnly, idOf, nobody, ownDataOnly } from '@/access'
import { auditTrail } from '@/hooks/auditTrail'
import { setOwner } from '@/hooks/careContext'
import { OBSERVATION_ANSWER_TYPES, WEEKDAYS } from '@/lib/options'
import { reviewDates } from '@/lib/schedule'

/**
 * Una línea del plan: un producto de «Mis productos», la cantidad que el
 * cliente declara, cuándo la toma y durante qué periodo. El sistema no
 * recomienda ni ajusta cantidades (decisión del 7-10-2026). La etiqueta del
 * fabricante se muestra como referencia, separada de lo que el cliente registra.
 */
const prepare: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  if (operation !== 'create') return data
  const { payload } = req

  const cp = await payload.findByID({ collection: 'customer-products', id: idOf(data.customerProduct)!, depth: 0, req, overrideAccess: true })
  if (String(idOf(cp.customer)) !== String(data.customer)) throw new APIError('Este producto no está en tu lista.', 403, undefined, true)
  if (cp.status !== 'active') throw new APIError('Confirma primero el producto en «Mis productos».', 400, undefined, true)
  data.product = idOf(cp.product)
  data.formulation = idOf(cp.formulation)

  // Un plan por cliente: se crea con la primera línea.
  const plans = await payload.find({ collection: 'plans', where: { customer: { equals: data.customer } }, limit: 1, depth: 0, req, overrideAccess: true })
  data.plan = plans.docs[0]?.id ?? (await payload.create({ collection: 'plans', data: { customer: data.customer, professionalReview: { status: 'not-reviewed' } }, req, overrideAccess: true, context: { system: true } })).id

  // Ritmo: plantilla editorial de la ficha, que el cliente puede cambiar.
  const formulation = await payload.findByID({ collection: 'formulations', id: idOf(data.formulation)!, depth: 1, req, overrideAccess: true })
  const ingredient = formulation.composition?.[0]?.ingredient
  if (ingredient && typeof ingredient === 'object') {
    data.rhythm ??= idOf(ingredient.rhythm)
    data.reviewQuestion ||= ingredient.reviewQuestion
    if (!data.observations?.length) data.observations = (ingredient.observations ?? []).map((o) => ({ text: o.text, answerType: o.answerType }))
  }
  if (data.rhythm != null) {
    const rhythm = await payload.findByID({ collection: 'rhythms', id: idOf(data.rhythm)!, depth: 0, req, overrideAccess: true })
    data.continuous ??= rhythm.continuous
    data.useWeeks ??= rhythm.useWeeks
    data.pauseWeeks ??= rhythm.pauseWeeks
    data.reviewEveryWeeks ??= rhythm.reviewEveryWeeks
    data.pauseIsMinimum ??= rhythm.pauseIsMinimum
  }
  return data
}

const validate: CollectionBeforeChangeHook = ({ data, originalDoc, operation }) => {
  const d = { ...originalDoc, ...data }
  if (!d.intakes?.length) throw new APIError('Indica al menos una toma: cuándo y cuántas unidades.', 400, undefined, true)
  if (d.scheduleType === 'weekdays' && !d.weekdays?.length) throw new APIError('Indica los días de la semana.', 400, undefined, true)
  // Nunca «cuando lo necesite» sin contexto (Libro 1 v2.0, cap. 6).
  if (d.scheduleType === 'selective' && !d.selectiveCircumstances) throw new APIError('Describe en qué circunstancias lo usarás.', 400, undefined, true)
  if (!d.continuous && (d.useWeeks == null || d.pauseWeeks == null) && !d.reviewOn) {
    throw new APIError('Indica las semanas de uso y de pausa, uso continuo o una fecha de revisión.', 400, undefined, true)
  }
  if (d.continuous && d.reviewEveryWeeks == null) throw new APIError('El uso continuo necesita un intervalo de revisión.', 400, undefined, true)
  // Cambiar el producto de una línea es otra línea: se conserva el historial.
  if (operation === 'update' && String(idOf(data.customerProduct ?? originalDoc.customerProduct)) !== String(idOf(originalDoc.customerProduct))) {
    throw new APIError('Para otro producto, crea una línea nueva.', 400, undefined, true)
  }
  return data
}

/** Crea las revisiones previstas del ciclo. No renueva nada al terminar. */
const scheduleReviews: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (operation !== 'create') return doc
  const dates = doc.reviewOn
    ? [{ date: doc.reviewOn, kind: 'periodic' as const }]
    : doc.continuous
      ? reviewDates(doc, addWeeks(doc.startDate, doc.reviewEveryWeeks)).slice(0, 1)
      : reviewDates(doc)
  for (const { date, kind } of dates) {
    await req.payload.create({
      collection: 'reviews',
      data: { planItem: doc.id, customer: idOf(doc.customer), dueDate: date, kind, reviewQuestion: doc.reviewQuestion, status: 'pending' },
      req,
      overrideAccess: true,
      context: { system: true },
    })
  }
  return doc
}

const addWeeks = (iso: string, weeks: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + weeks * 7)).toISOString().slice(0, 10)
}

const isoDate = (value: unknown) => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) || 'Formato AAAA-MM-DD'
const isoDateOptional = (value: unknown) => value == null || value === '' || isoDate(value)
const hhmm = (value: unknown) => value == null || value === '' || (typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)) || 'Formato HH:MM'

export const PlanItems: CollectionConfig = {
  slug: 'plan-items',
  labels: { singular: 'Línea del plan', plural: 'Líneas del plan' },
  admin: { group: 'Seguimiento del cliente', useAsTitle: 'id', defaultColumns: ['customer', 'product', 'startDate', 'status'] },
  access: { read: ownDataOnly(), create: customersOnly, update: ownDataOnly(), delete: nobody },
  hooks: { beforeChange: [setOwner, prepare, validate], afterChange: [scheduleReviews, auditTrail] },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'customer', label: 'Cliente', type: 'relationship', relationTo: 'customers', required: true, index: true },
        { name: 'plan', label: 'Plan', type: 'relationship', relationTo: 'plans', admin: { readOnly: true } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'customerProduct', label: 'Producto (de «Mis productos»)', type: 'relationship', relationTo: 'customer-products', required: true },
        { name: 'product', label: 'Producto', type: 'relationship', relationTo: 'products', admin: { readOnly: true } },
        { name: 'formulation', label: 'Composición', type: 'relationship', relationTo: 'formulations', admin: { readOnly: true } },
      ],
    },
    {
      name: 'intakes',
      label: 'Tomas declaradas por el cliente',
      type: 'array',
      minRows: 1,
      maxRows: 6,
      labels: { singular: 'Toma', plural: 'Tomas' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'block', label: 'Momento del día', type: 'relationship', relationTo: 'blocks', required: true },
            { name: 'time', label: 'Hora del recordatorio (HH:MM)', type: 'text', validate: hhmm },
            { name: 'servings', label: 'Unidades', type: 'number', required: true, min: 0.25 },
          ],
        },
      ],
    },
    { name: 'note', label: 'Nota personal', type: 'textarea' },
    {
      type: 'collapsible',
      label: 'Días',
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
            { label: 'Uso selectivo en circunstancias definidas', value: 'selective' },
          ],
        },
        { name: 'weekdays', label: 'Días', type: 'select', hasMany: true, options: WEEKDAYS, admin: { condition: (d) => d?.scheduleType === 'weekdays' } },
        { name: 'selectiveCircumstances', label: 'Circunstancias', type: 'textarea', admin: { condition: (d) => d?.scheduleType === 'selective' } },
      ],
    },
    {
      type: 'collapsible',
      label: 'Periodo y revisión',
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'startDate', label: 'Fecha real de inicio', type: 'text', required: true, validate: isoDate, admin: { description: 'La elige el cliente. La compra o la entrega no la fijan.' } },
            { name: 'rhythm', label: 'Ritmo', type: 'relationship', relationTo: 'rhythms' },
            { name: 'reviewOn', label: 'O solo una fecha de revisión', type: 'text', validate: isoDateOptional },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'continuous', label: 'Uso continuo', type: 'checkbox' },
            { name: 'useWeeks', label: 'Semanas de uso', type: 'number', min: 1 },
            { name: 'pauseWeeks', label: 'Semanas de pausa', type: 'number', min: 0 },
            { name: 'reviewEveryWeeks', label: 'Revisión cada (semanas)', type: 'number', min: 1 },
            { name: 'pauseIsMinimum', label: 'Pausa mínima', type: 'checkbox' },
          ],
        },
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
      type: 'collapsible',
      label: 'Estado',
      fields: [
        {
          name: 'status',
          label: 'Estado',
          type: 'select',
          required: true,
          defaultValue: 'active',
          options: [
            { label: 'Activa', value: 'active' },
            { label: 'Pausada', value: 'paused' },
            { label: 'Interrumpida', value: 'interrupted' },
            { label: 'Finalizada', value: 'ended' },
          ],
        },
        {
          name: 'pauses',
          label: 'Pausas temporales',
          type: 'array',
          admin: { description: 'Una pausa no alarga ni reinicia el ciclo.' },
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
  ],
}

