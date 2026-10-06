import { APIError, type CollectionBeforeChangeHook, type CollectionConfig } from 'payload'
import type { AccessResult } from 'payload'

import { chainOf, hasRole, isStaffUser, ROLES, STAFF_PERMISSIONS } from '@/access'

/**
 * Personal con acceso al panel: equipo Newtons, administración de cadenas y
 * personal de droguería. Un permiso informático no concede una competencia
 * profesional (Libro 2, n.º 21).
 */
const chainAdminGuard: CollectionBeforeChangeHook = ({ data, req, originalDoc }) => {
  const user = req.user
  if (!hasRole(user, 'chain-admin')) return data
  // La administración de una cadena solo gestiona personal de su propia cadena.
  data.chain = chainOf(user)
  const role = data.role ?? originalDoc?.role ?? 'staff'
  if (role !== 'staff' && originalDoc?.id !== user?.id) {
    throw new APIError('La administración de la cadena solo puede gestionar personal de droguería.', 403, undefined, true)
  }
  return data
}

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Usuario del panel', plural: 'Usuarios del panel' },
  auth: true,
  admin: { group: 'Droguerías', useAsTitle: 'name', defaultColumns: ['name', 'email', 'role', 'chain'] },
  access: {
    admin: ({ req: { user } }) => isStaffUser(user),
    read: ({ req: { user } }): AccessResult => {
      if (hasRole(user, 'newtons-admin')) return true
      if (hasRole(user, 'chain-admin')) return { chain: { equals: chainOf(user) } }
      return isStaffUser(user) ? { id: { equals: user.id } } : false
    },
    create: ({ req: { user } }) => hasRole(user, 'newtons-admin', 'chain-admin'),
    update: ({ req: { user } }): AccessResult => {
      if (hasRole(user, 'newtons-admin')) return true
      if (hasRole(user, 'chain-admin')) return { chain: { equals: chainOf(user) } }
      return isStaffUser(user) ? { id: { equals: user.id } } : false
    },
    delete: ({ req: { user } }): AccessResult => {
      if (hasRole(user, 'newtons-admin')) return true
      if (hasRole(user, 'chain-admin')) return { and: [{ chain: { equals: chainOf(user) } }, { role: { equals: 'staff' } }] }
      return false
    },
  },
  hooks: { beforeChange: [chainAdminGuard] },
  fields: [
    { name: 'name', label: 'Nombre', type: 'text', required: true },
    {
      name: 'role',
      label: 'Rol',
      type: 'select',
      required: true,
      defaultValue: 'staff',
      options: [...ROLES],
      saveToJWT: true,
      access: { update: ({ req: { user } }) => hasRole(user, 'newtons-admin') },
    },
    {
      name: 'chain',
      label: 'Cadena',
      type: 'relationship',
      relationTo: 'chains',
      saveToJWT: true,
      admin: { condition: (data) => data?.role === 'chain-admin' || data?.role === 'staff' },
    },
    {
      name: 'stores',
      label: 'Establecimientos',
      type: 'relationship',
      relationTo: 'stores',
      hasMany: true,
      saveToJWT: true,
      admin: { condition: (data) => data?.role === 'staff', description: 'Vacío = todos los de la cadena.' },
    },
    {
      name: 'permissions',
      label: 'Permisos',
      type: 'select',
      hasMany: true,
      options: [...STAFF_PERMISSIONS],
      saveToJWT: true,
      admin: { condition: (data) => data?.role === 'staff' },
      access: { update: ({ req: { user } }) => hasRole(user, 'newtons-admin', 'chain-admin') },
    },
    { name: 'professionalTitle', label: 'Titulación profesional', type: 'text', admin: { condition: (data) => data?.role === 'staff' || data?.role === 'reviewer' } },
  ],
}
