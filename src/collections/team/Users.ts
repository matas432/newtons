import type { CollectionConfig } from 'payload'

import { admin, hasRole, isStaffUser, ROLES } from '@/access'

/**
 * Equipo Newtons con acceso al panel. Un rol en el panel no otorga una
 * competencia profesional (Libro 1 v2.0, cap. 14).
 */
export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Usuario del equipo', plural: 'Equipo' },
  auth: true,
  admin: { group: 'Sistema', useAsTitle: 'name', defaultColumns: ['name', 'email', 'role'] },
  access: {
    admin: ({ req: { user } }) => isStaffUser(user),
    read: ({ req: { user } }) => (hasRole(user, 'admin') ? true : isStaffUser(user) ? { id: { equals: user.id } } : false),
    create: admin,
    update: ({ req: { user } }) => (hasRole(user, 'admin') ? true : isStaffUser(user) ? { id: { equals: user.id } } : false),
    delete: admin,
  },
  fields: [
    { name: 'name', label: 'Nombre', type: 'text', required: true },
    {
      name: 'role',
      label: 'Rol',
      type: 'select',
      required: true,
      defaultValue: 'editor',
      options: [...ROLES],
      saveToJWT: true,
      access: { update: ({ req: { user } }) => hasRole(user, 'admin') },
    },
    { name: 'professionalTitle', label: 'Titulación profesional', type: 'text', admin: { description: 'Solo informativo. No concede permisos.' } },
  ],
}
