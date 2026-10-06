import type { CollectionConfig } from 'payload'

import { anyStaff, editorial, isCustomer } from '@/access'

/**
 * Producto comercial: identidad de la presentación. La composición vive en
 * `formulations`, con versiones (Libro 2, n.º 10).
 */
export const Products: CollectionConfig = {
  slug: 'products',
  labels: { singular: 'Producto', plural: 'Productos' },
  admin: { group: 'Catálogo', useAsTitle: 'name', defaultColumns: ['name', 'brand', 'form', 'status', 'isFictional'] },
  access: {
    read: (args) => (isCustomer(args.req.user) ? true : anyStaff(args)),
    create: editorial,
    update: editorial,
    delete: editorial,
  },
  fields: [
    { name: 'name', label: 'Nombre del producto', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        { name: 'brand', label: 'Marca', type: 'text' },
        { name: 'manufacturer', label: 'Fabricante', type: 'text' },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'form',
          label: 'Presentación',
          type: 'select',
          required: true,
          options: [
            { label: 'Cápsula', value: 'capsule' },
            { label: 'Cápsula blanda', value: 'softgel' },
            { label: 'Comprimido', value: 'tablet' },
            { label: 'Polvo', value: 'powder' },
            { label: 'Líquido', value: 'liquid' },
            { label: 'Gominola', value: 'gummy' },
            { label: 'Otra', value: 'other' },
          ],
        },
        { name: 'servingUnit', label: 'Unidad de toma', type: 'text', required: true, admin: { description: 'p. ej. «cápsula», «medida de 5 g»' } },
        { name: 'unitsPerContainer', label: 'Unidades por envase', type: 'number' },
      ],
    },
    { name: 'gtin', label: 'GTIN / código de barras', type: 'text', hasMany: true, admin: { description: 'Identificador, no prueba de composición (Libro 2, n.º 11).' } },
    { name: 'currentFormulation', label: 'Formulación vigente', type: 'relationship', relationTo: 'formulations', admin: { description: 'Se rellena al verificar una formulación.' } },
    { name: 'labelImages', label: 'Fotos de la etiqueta', type: 'upload', relationTo: 'media', hasMany: true },
    {
      name: 'status',
      label: 'Estado',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Activo', value: 'active' },
        { label: 'Descatalogado', value: 'discontinued' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'isFictional', label: 'Producto ficticio (demo)', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar' } },
    {
      name: 'submittedByCustomer',
      label: 'Aportado por un cliente',
      type: 'relationship',
      relationTo: 'customers',
      admin: { position: 'sidebar', readOnly: true, description: 'Producto comprado fuera de la cadena, pendiente de verificación (Libro 2, n.º 12).' },
    },
  ],
}
