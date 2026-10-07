import type { AccessResult, CollectionConfig } from 'payload'

import { canApprove, isCustomer, nobody, ownDataOnly } from '@/access'
import { auditTrail } from '@/hooks/auditTrail'
import { serverControlled } from '@/hooks/careContext'

/**
 * Plan personal: lo que el cliente dice que tiene intención de tomar
 * (decisión del 7-10-2026). Un plan por cliente; se crea al añadir la primera
 * línea. La revisión profesional es un estado aparte que nunca se presupone:
 * por defecto «sin revisión profesional».
 */
export const Plans: CollectionConfig = {
  slug: 'plans',
  labels: { singular: 'Plan', plural: 'Planes' },
  admin: { group: 'Seguimiento del cliente', useAsTitle: 'id', defaultColumns: ['customer', 'professionalReview.status', 'updatedAt'] },
  access: {
    read: ownDataOnly(),
    // Se crea automáticamente desde la primera línea del plan.
    create: nobody,
    // La revisión profesional individual se activará más adelante, con su propio permiso.
    update: ({ req: { user } }): AccessResult => (isCustomer(user) ? { customer: { equals: user.id } } : false),
    delete: nobody,
  },
  hooks: { beforeChange: [serverControlled(['customer', 'professionalReview'])], afterChange: [auditTrail] },
  fields: [
    { name: 'customer', label: 'Cliente', type: 'relationship', relationTo: 'customers', required: true, unique: true, index: true },
    {
      name: 'professionalReview',
      label: 'Revisión profesional',
      type: 'group',
      admin: { description: 'Separada del plan del cliente. Solo cambia si un profesional revisa realmente el plan.' },
      access: { update: ({ req: { user } }) => canApprove(user) },
      fields: [
        {
          name: 'status',
          label: 'Estado',
          type: 'select',
          required: true,
          defaultValue: 'not-reviewed',
          options: [
            { label: 'Sin revisión profesional', value: 'not-reviewed' },
            { label: 'Revisión solicitada', value: 'requested' },
            { label: 'Revisado por un profesional', value: 'reviewed' },
          ],
        },
        { name: 'reviewer', label: 'Profesional', type: 'relationship', relationTo: 'users' },
        { name: 'reviewedAt', label: 'Revisado el', type: 'date' },
        { name: 'note', label: 'Nota', type: 'textarea' },
      ],
    },
  ],
}
