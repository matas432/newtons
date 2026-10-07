import type { CollectionConfig } from 'payload'

import { hasRole, isEditorial, isOperations } from '@/access'

/**
 * Proveedores. «Candidato» no es «elegido»: las condiciones deben constar por
 * escrito antes de comprar (Libro 1 v2.0, cap. 3).
 */
export const Suppliers: CollectionConfig = {
  slug: 'suppliers',
  labels: { singular: 'Proveedor', plural: 'Proveedores' },
  admin: { group: 'Catálogo', useAsTitle: 'name', defaultColumns: ['name', 'status', 'country'] },
  access: {
    read: ({ req: { user } }) => isEditorial(user) || isOperations(user),
    create: ({ req: { user } }) => isOperations(user),
    update: ({ req: { user } }) => isOperations(user),
    delete: ({ req: { user } }) => hasRole(user, 'admin'),
  },
  fields: [
    { name: 'name', label: 'Nombre', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        {
          name: 'status',
          label: 'Estado',
          type: 'select',
          required: true,
          defaultValue: 'candidate',
          options: [
            { label: 'Candidato', value: 'candidate' },
            { label: 'Condiciones confirmadas por escrito', value: 'confirmed' },
            { label: 'Inactivo', value: 'inactive' },
          ],
        },
        { name: 'country', label: 'País', type: 'text', defaultValue: 'CH' },
        { name: 'website', label: 'Web', type: 'text' },
      ],
    },
    {
      name: 'contact',
      label: 'Contacto',
      type: 'group',
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'person', label: 'Persona', type: 'text' },
            { name: 'email', label: 'Correo', type: 'email' },
            { name: 'phone', label: 'Teléfono', type: 'text' },
          ],
        },
      ],
    },
    {
      name: 'terms',
      label: 'Condiciones comerciales',
      type: 'group',
      admin: { description: 'Precio profesional, IVA, mínimos, transporte de entrada, plazos de pago, permisos de reventa y uso de imágenes.' },
      fields: [
        { name: 'summary', label: 'Resumen', type: 'textarea' },
        {
          type: 'row',
          fields: [
            { name: 'minimumOrder', label: 'Mínimo de pedido', type: 'text' },
            { name: 'paymentTerms', label: 'Plazo de pago', type: 'text' },
            { name: 'inboundShipping', label: 'Transporte de entrada', type: 'text' },
          ],
        },
        { name: 'resaleRights', label: 'Permisos de reventa, imágenes y marca', type: 'textarea' },
        { name: 'documents', label: 'Documentos', type: 'upload', relationTo: 'media', hasMany: true },
      ],
    },
    { name: 'notes', label: 'Notas', type: 'textarea' },
  ],
}
