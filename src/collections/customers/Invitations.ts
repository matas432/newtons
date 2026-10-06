import crypto from 'crypto'
import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'

import { chainOf, hasPermission, hasRole, isStaffUser } from '@/access'
import { forceOwnChain } from '@/hooks/forceOwnChain'

const canInvite = (user: any) => hasPermission(user, 'invite') || hasRole(user, 'chain-admin')

const prepare: CollectionBeforeChangeHook = ({ data, operation, req }) => {
  if (operation === 'create') {
    data.token = crypto.randomBytes(24).toString('base64url')
    if (!data.expiresAt) data.expiresAt = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString()
    if (isStaffUser(req.user)) data.createdBy = req.user.id
  }
  return data
}

/** Invitación de la droguería a un cliente (Libro 2, n.º 6: acceso solo por invitación). */
export const Invitations: CollectionConfig = {
  slug: 'invitations',
  labels: { singular: 'Invitación', plural: 'Invitaciones' },
  admin: { group: 'Clientes y planes', useAsTitle: 'email', defaultColumns: ['email', 'store', 'status', 'expiresAt'] },
  access: {
    read: ({ req: { user } }) => (hasRole(user, 'newtons-admin') ? true : canInvite(user) ? { chain: { equals: chainOf(user) } } : false),
    create: ({ req: { user } }) => canInvite(user),
    update: ({ req: { user } }) => (canInvite(user) ? { chain: { equals: chainOf(user) } } : false),
    delete: () => false,
  },
  hooks: { beforeChange: [forceOwnChain, prepare] },
  fields: [
    { name: 'email', label: 'Correo del cliente', type: 'email', required: true },
    { name: 'chain', label: 'Cadena', type: 'relationship', relationTo: 'chains', required: true },
    { name: 'store', label: 'Establecimiento', type: 'relationship', relationTo: 'stores', required: true },
    {
      name: 'status',
      label: 'Estado',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pendiente', value: 'pending' },
        { label: 'Aceptada', value: 'accepted' },
        { label: 'Revocada', value: 'revoked' },
      ],
    },
    { name: 'token', label: 'Código', type: 'text', unique: true, index: true, admin: { readOnly: true } },
    { name: 'expiresAt', label: 'Caduca el', type: 'date', admin: { readOnly: true } },
    { name: 'createdBy', label: 'Creada por', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
    { name: 'customer', label: 'Cliente', type: 'relationship', relationTo: 'customers', admin: { readOnly: true } },
  ],
}
