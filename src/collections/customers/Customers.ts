import type { CollectionConfig } from 'payload'
import type { AccessResult } from 'payload'

import { chainOf, hasPermission, isCustomer, nobody } from '@/access'

/**
 * Cuenta personal Newtons del cliente (Libro 2, n.º 5). No pertenece a una
 * cadena: se vincula a droguerías mediante `customer-links`. Nunca entra al
 * panel de administración. Datos mínimos (Libro 2, n.º 7).
 */
export const Customers: CollectionConfig = {
  slug: 'customers',
  labels: { singular: 'Cliente', plural: 'Clientes' },
  auth: { tokenExpiration: 60 * 60 * 24 * 7 },
  admin: { group: 'Clientes y planes', useAsTitle: 'alias', defaultColumns: ['alias', 'email', 'language'] },
  access: {
    admin: () => false,
    read: ({ req: { user } }): AccessResult => {
      if (isCustomer(user)) return { id: { equals: user.id } }
      // El personal ve solo clientes vinculados a su cadena.
      const anyCare = (['invite', 'prepare-plans', 'confirm-plans', 'view-shared-data'] as const).some((p) => hasPermission(user, p))
      if (anyCare) return { linkedChains: { in: [chainOf(user)] } }
      return false
    },
    // Las cuentas se crean al aceptar una invitación (servidor, sin acceso directo).
    create: nobody,
    update: ({ req: { user } }) => (isCustomer(user) ? { id: { equals: user.id } } : false),
    delete: nobody,
  },
  fields: [
    { name: 'alias', label: 'Nombre de uso o alias', type: 'text', required: true },
    {
      name: 'language',
      label: 'Idioma',
      type: 'select',
      required: true,
      defaultValue: 'es',
      options: [
        { label: 'Español', value: 'es' },
        { label: 'Deutsch (Schweiz)', value: 'de-CH' },
      ],
    },
    { name: 'adultConfirmed', label: 'Confirma ser mayor de edad', type: 'checkbox', required: true, defaultValue: false },
    { name: 'timezone', label: 'Zona horaria', type: 'text', defaultValue: 'Europe/Zurich' },
    {
      name: 'linkedChains',
      label: 'Cadenas vinculadas',
      type: 'relationship',
      relationTo: 'chains',
      hasMany: true,
      access: { update: () => false },
      admin: { readOnly: true, description: 'Se mantiene automáticamente desde las vinculaciones activas.' },
    },
    { name: 'isFictional', label: 'Cliente ficticio (demo)', type: 'checkbox', defaultValue: false, access: { update: () => false } },
  ],
}
