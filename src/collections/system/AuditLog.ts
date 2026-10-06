import type { CollectionConfig } from 'payload'

import { hiddenUnless, newtonsAdmin, nobody } from '@/access'

export const AuditLog: CollectionConfig = {
  slug: 'audit-log',
  labels: { singular: 'Registro de cambios', plural: 'Registro de cambios' },
  admin: {
    group: 'Sistema',
    useAsTitle: 'targetCollection',
    defaultColumns: ['createdAt', 'targetCollection', 'targetId', 'operation', 'actorCollection', 'actorId', 'reason'],
    hidden: hiddenUnless('newtons-admin'),
  },
  access: { read: newtonsAdmin, create: nobody, update: nobody, delete: nobody },
  fields: [
    { name: 'targetCollection', label: 'Colección', type: 'text', required: true, index: true },
    { name: 'targetId', label: 'Documento', type: 'text', required: true, index: true },
    {
      name: 'operation',
      label: 'Operación',
      type: 'select',
      required: true,
      options: [
        { label: 'Creación', value: 'create' },
        { label: 'Modificación', value: 'update' },
        { label: 'Eliminación', value: 'delete' },
      ],
    },
    { name: 'changedFields', label: 'Campos modificados', type: 'text', hasMany: true },
    { name: 'reason', label: 'Motivo', type: 'text' },
    { name: 'actorCollection', label: 'Tipo de autor', type: 'text' },
    { name: 'actorId', label: 'Autor', type: 'text' },
  ],
}
