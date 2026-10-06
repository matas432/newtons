import type { CollectionConfig } from 'payload'

import { anyone, chainOf, hasRole, newtonsAdmin } from '@/access'

/** Cadena de droguerías = cliente comercial (tenant). */
export const Chains: CollectionConfig = {
  slug: 'chains',
  labels: { singular: 'Cadena', plural: 'Cadenas' },
  admin: { group: 'Droguerías', useAsTitle: 'name', defaultColumns: ['name', 'slug', 'isFictional'] },
  access: {
    // La marca se muestra en la página pública de invitación (QR).
    read: anyone,
    create: newtonsAdmin,
    delete: newtonsAdmin,
    update: ({ req: { user } }) => {
      if (hasRole(user, 'newtons-admin')) return true
      if (hasRole(user, 'chain-admin')) return { id: { equals: chainOf(user) } }
      return false
    },
  },
  fields: [
    { name: 'name', label: 'Nombre', type: 'text', required: true },
    { name: 'slug', label: 'Identificador en la URL', type: 'text', required: true, unique: true, index: true, access: { update: ({ req: { user } }) => hasRole(user, 'newtons-admin') } },
    {
      name: 'branding',
      label: 'Identidad visual',
      type: 'group',
      admin: { description: 'Libro 2, n.º 34: logo, colores, nombre, contacto y bienvenida. Nada fijo en el código.' },
      fields: [
        { name: 'displayName', label: 'Nombre visible', type: 'text', required: true },
        { name: 'logo', label: 'Logo', type: 'upload', relationTo: 'media' },
        {
          type: 'row',
          fields: [
            { name: 'primaryColor', label: 'Color principal', type: 'text', defaultValue: '#1F3A5F', validate: hex },
            { name: 'accentColor', label: 'Color de acento', type: 'text', defaultValue: '#E8ECF1', validate: hex },
          ],
        },
        { name: 'welcomeMessage', label: 'Mensaje de bienvenida', type: 'textarea', localized: true },
        {
          name: 'coBranding',
          label: 'Modalidad de marca',
          type: 'select',
          defaultValue: 'shared',
          options: [{ label: 'Marca compartida («Con tecnología de Newtons»)', value: 'shared' }],
          access: { update: ({ req: { user } }) => hasRole(user, 'newtons-admin') },
        },
      ],
    },
    {
      name: 'contact',
      label: 'Contacto para clientes',
      type: 'group',
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'email', label: 'Correo', type: 'email' },
            { name: 'phone', label: 'Teléfono', type: 'text' },
          ],
        },
      ],
    },
    { name: 'isFictional', label: 'Cadena ficticia (demo)', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar' } },
  ],
}

function hex(value: unknown) {
  return value == null || value === '' || (typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)) || 'Color en formato #RRGGBB'
}
