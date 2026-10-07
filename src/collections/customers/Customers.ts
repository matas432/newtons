import { APIError, type AccessResult, type CollectionConfig } from 'payload'

import { anyone, hasRole, isCustomer, nobody } from '@/access'

/**
 * Cuenta personal Newtons (Libro 1 v2.0, cap. 13): registro directo, sin
 * droguería intermediaria. Datos mínimos para el acceso: correo verificado,
 * nombre de uso e idioma. La dirección de entrega se guarda en cada pedido.
 */
export const Customers: CollectionConfig = {
  slug: 'customers',
  labels: { singular: 'Cliente', plural: 'Clientes' },
  auth: { verify: true, tokenExpiration: 60 * 60 * 24 * 7 },
  admin: { group: 'Clientes', useAsTitle: 'alias', defaultColumns: ['alias', 'email', 'language', 'createdAt'] },
  access: {
    admin: () => false,
    read: ({ req: { user } }): AccessResult => {
      if (isCustomer(user)) return { id: { equals: user.id } }
      // Soporte y administración ven la cuenta (no el seguimiento) para atender incidencias.
      return hasRole(user, 'admin', 'support', 'operations')
    },
    create: anyone,
    update: ({ req: { user } }): AccessResult => (isCustomer(user) ? { id: { equals: user.id } } : hasRole(user, 'admin')),
    delete: nobody,
  },
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        if (operation === 'create' && data.adultConfirmed !== true) {
          throw new APIError('El servicio es para personas adultas.', 400, undefined, true)
        }
        return data
      },
    ],
  },
  fields: [
    { name: 'alias', label: 'Nombre de uso', type: 'text', required: true },
    {
      name: 'language',
      label: 'Idioma',
      type: 'select',
      required: true,
      defaultValue: 'de',
      options: [
        { label: 'Deutsch', value: 'de' },
        { label: 'English', value: 'en' },
      ],
    },
    { name: 'adultConfirmed', label: 'Confirma ser mayor de edad', type: 'checkbox', required: true, defaultValue: false },
    { name: 'timezone', label: 'Zona horaria', type: 'text', defaultValue: 'Europe/Zurich' },
    { name: 'isFictional', label: 'Cliente ficticio (demo)', type: 'checkbox', defaultValue: false, access: { create: ({ req: { user } }) => hasRole(user, 'admin'), update: () => false } },
  ],
}
