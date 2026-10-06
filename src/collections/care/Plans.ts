import { APIError, type CollectionBeforeChangeHook, type CollectionConfig } from 'payload'

import { chainOf, hasPermission, healthData, healthDataRead, idOf, isStaffUser, nobody } from '@/access'
import { auditDelete, auditTrail } from '@/hooks/auditTrail'
import { requireChangeReason } from '@/hooks/careContext'

/**
 * Plan personal. Lo prepara el personal autorizado y lo confirma un
 * profesional autorizado (Libro 2, n.º 20 y 21). El cliente no lo modifica:
 * declara cambios, que quedan pendientes de revisión.
 */
const planWorkflow: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req }) => {
  const user = req.user
  if (!isStaffUser(user)) return data

  if (operation === 'create') {
    data.chain = chainOf(user)
    data.preparedBy = user.id
    const link = await req.payload.find({
      collection: 'customer-links',
      where: {
        and: [
          { customer: { equals: idOf(data.customer) } },
          { chain: { equals: data.chain } },
          { status: { equals: 'active' } },
        ],
      },
      limit: 1,
      depth: 0,
      req,
      overrideAccess: true,
    })
    if (!link.docs.length) throw new APIError('El cliente no está vinculado a esta droguería.', 400, undefined, true)
    data.store ??= idOf(link.docs[0].store)
  }

  const becomesActive = data.status === 'active' && originalDoc?.status !== 'active'
  if (becomesActive) {
    if (!hasPermission(user, 'confirm-plans')) {
      throw new APIError('Solo un profesional autorizado puede confirmar el plan.', 403, undefined, true)
    }
    data.confirmedBy = user.id
    data.confirmedAt = new Date().toISOString()
  }
  return data
}

export const Plans: CollectionConfig = {
  slug: 'plans',
  labels: { singular: 'Plan', plural: 'Planes' },
  admin: { group: 'Clientes y planes', useAsTitle: 'title', defaultColumns: ['title', 'customer', 'store', 'status', 'updatedAt'] },
  access: {
    read: healthDataRead(),
    create: ({ req: { user } }) => hasPermission(user, 'prepare-plans'),
    update: (args) => {
      const { user } = args.req
      if (hasPermission(user, 'confirm-plans')) return healthData('confirm-plans')(args)
      if (hasPermission(user, 'prepare-plans')) return healthData('prepare-plans')(args)
      return false
    },
    delete: nobody,
  },
  hooks: {
    beforeChange: [planWorkflow, requireChangeReason((doc) => doc?.status === 'draft')],
    afterChange: [auditTrail],
    afterDelete: [auditDelete],
  },
  fields: [
    { name: 'title', label: 'Título', type: 'text', required: true, defaultValue: 'Mi plan' },
    { name: 'customer', label: 'Cliente', type: 'relationship', relationTo: 'customers', required: true, index: true },
    {
      type: 'row',
      fields: [
        { name: 'chain', label: 'Cadena', type: 'relationship', relationTo: 'chains', required: true, index: true, admin: { readOnly: true } },
        { name: 'store', label: 'Establecimiento', type: 'relationship', relationTo: 'stores', index: true },
      ],
    },
    { name: 'goal', label: 'Objetivo acordado', type: 'textarea' },
    {
      name: 'status',
      label: 'Estado',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Borrador', value: 'draft' },
        { label: 'Pendiente de confirmación', value: 'pending-confirmation' },
        { label: 'Activo', value: 'active' },
        { label: 'Finalizado', value: 'ended' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'preparedBy', label: 'Preparado por', type: 'relationship', relationTo: 'users', admin: { position: 'sidebar', readOnly: true } },
    { name: 'confirmedBy', label: 'Confirmado por', type: 'relationship', relationTo: 'users', admin: { position: 'sidebar', readOnly: true } },
    { name: 'confirmedAt', label: 'Confirmado el', type: 'date', admin: { position: 'sidebar', readOnly: true } },
    { name: 'changeReason', label: 'Motivo del último cambio', type: 'text', admin: { position: 'sidebar', description: 'Obligatorio al modificar un plan que no es borrador.' } },
    { name: 'professionalNotes', label: 'Notas profesionales', type: 'textarea' },
  ],
}
