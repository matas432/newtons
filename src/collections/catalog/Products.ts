import { APIError, type CollectionBeforeChangeHook, type CollectionConfig } from 'payload'

import { anyone, idOf, isEditorial, isOperations } from '@/access'

/**
 * Producto comercial: un envase concreto de un fabricante. La composición
 * vive en `formulations`, con versiones. Un producto puede estar en la
 * biblioteca (externo verificado) sin estar a la venta.
 */

/**
 * Libro 1 v2.0, cap. 2: un producto solo se pone a la venta con composición,
 * situación comercial, proveedor, origen, suministro y ficha verificados.
 */
const guardForSale: CollectionBeforeChangeHook = async ({ data, originalDoc, req, context }) => {
  if (context?.skipGuards) return data
  if (data.saleStatus !== 'for-sale' || originalDoc?.saleStatus === 'for-sale' && sameSaleInputs(data, originalDoc)) return data
  const missing: string[] = []
  if (data.kind !== 'catalog') missing.push('ser un producto del catálogo propio')
  if (data.price == null || data.price <= 0) missing.push('precio')
  if (!data.supplier) missing.push('proveedor')
  if (!data.origin?.countryOfManufacture) missing.push('país de fabricación')
  if (data.storage?.coldChainRequired) missing.push('logística sin cadena de frío (este producto la requiere)')
  if (!data.currentFormulation) {
    missing.push('formulación verificada')
  } else {
    const formulation = await req.payload.findByID({ collection: 'formulations', id: idOf(data.currentFormulation)!, depth: 1, req, overrideAccess: true })
    if (formulation.verificationStatus !== 'verified') missing.push('formulación verificada')
    for (const row of formulation.composition ?? []) {
      const ing = row.ingredient
      if (typeof ing !== 'object' || !ing) continue
      if (ing.poolStatus !== 'in-pool') missing.push(`«${ing.name}» en el pool`)
      if (ing.editorialStatus !== 'approved') missing.push(`ficha de «${ing.name}» aprobada`)
    }
  }
  if (missing.length) {
    throw new APIError(`No se puede poner a la venta. Falta: ${[...new Set(missing)].join(', ')}.`, 400, undefined, true)
  }
  return data
}

const sameSaleInputs = (a: any, b: any) =>
  String(idOf(a.currentFormulation)) === String(idOf(b.currentFormulation)) && a.price === b.price && String(idOf(a.supplier)) === String(idOf(b.supplier))

export const Products: CollectionConfig = {
  slug: 'products',
  labels: { singular: 'Producto', plural: 'Productos' },
  admin: { group: 'Catálogo', useAsTitle: 'name', defaultColumns: ['name', 'brand', 'kind', 'saleStatus', 'price'] },
  access: {
    // La información de producto es pública: no contiene datos personales.
    read: anyone,
    create: ({ req: { user } }) => isEditorial(user) || isOperations(user),
    update: ({ req: { user } }) => isEditorial(user) || isOperations(user),
    delete: ({ req: { user } }) => isEditorial(user),
  },
  hooks: { beforeChange: [guardForSale] },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Producto',
          fields: [
            { name: 'name', label: 'Nombre del producto', type: 'text', required: true },
            { name: 'slug', label: 'Identificador en la URL', type: 'text', unique: true, index: true },
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
                { name: 'servingUnit', label: 'Unidad de toma', type: 'text', required: true, localized: true, admin: { description: 'p. ej. «Kapsel», «capsule»' } },
                { name: 'unitsPerContainer', label: 'Unidades por envase', type: 'number' },
              ],
            },
            { name: 'shortDescription', label: 'Descripción breve', type: 'textarea', localized: true, admin: { description: 'Sin declaraciones de salud: describe el producto, no sus efectos.' } },
            { name: 'gtin', label: 'GTIN / código de barras', type: 'text', hasMany: true, admin: { description: 'Identificador, no prueba de composición.' } },
            { name: 'currentFormulation', label: 'Formulación vigente', type: 'relationship', relationTo: 'formulations', admin: { description: 'Se rellena al verificar una formulación.' } },
            { name: 'labelImages', label: 'Fotos de la etiqueta', type: 'upload', relationTo: 'media', hasMany: true },
          ],
        },
        {
          label: 'Venta',
          fields: [
            {
              type: 'row',
              fields: [
                { name: 'sku', label: 'Referencia interna (SKU)', type: 'text', unique: true },
                { name: 'price', label: 'Precio de venta (CHF, IVA incl.)', type: 'number', min: 0 },
                { name: 'vatRate', label: 'IVA (%)', type: 'number', defaultValue: 2.6, admin: { description: 'Confirmar con asesoría fiscal.' } },
              ],
            },
            { name: 'supplier', label: 'Proveedor', type: 'relationship', relationTo: 'suppliers' },
            { name: 'weightGrams', label: 'Peso con envase (g)', type: 'number', admin: { description: 'Para calcular el peso del paquete.' } },
            {
              name: 'origin',
              label: 'Origen documentado',
              type: 'group',
              admin: { description: 'Solo lo que podamos justificar. «Fabricado en Suiza» no convierte toda materia prima en suiza (Libro 1 v2.0, cap. 3).' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'countryOfManufacture', label: 'País de fabricación', type: 'text' },
                    { name: 'packagingPlace', label: 'Lugar de envasado', type: 'text' },
                    { name: 'responsibleCompany', label: 'Empresa responsable', type: 'text' },
                  ],
                },
                { name: 'ingredientOrigin', label: 'Origen de ingredientes (si está documentado)', type: 'textarea' },
                { name: 'evidence', label: 'Documento que lo respalda', type: 'text' },
              ],
            },
            {
              name: 'storage',
              label: 'Almacenamiento y transporte',
              type: 'group',
              fields: [
                { name: 'conditions', label: 'Condiciones según fabricante', type: 'text' },
                { name: 'coldChainRequired', label: 'Requiere cadena de frío', type: 'checkbox', defaultValue: false, admin: { description: 'Si se marca, no puede venderse con envío estándar.' } },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'kind',
      label: 'Tipo',
      type: 'select',
      required: true,
      defaultValue: 'catalog',
      options: [
        { label: 'Catálogo propio', value: 'catalog' },
        { label: 'Externo verificado (comprado en otro lugar)', value: 'external' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'saleStatus',
      label: 'Venta',
      type: 'select',
      required: true,
      defaultValue: 'not-for-sale',
      options: [
        { label: 'No a la venta', value: 'not-for-sale' },
        { label: 'A la venta', value: 'for-sale' },
        { label: 'Venta pausada', value: 'paused' },
        { label: 'Descatalogado', value: 'discontinued' },
      ],
      admin: { position: 'sidebar', description: 'Poner a la venta exige formulación verificada, pool, ficha aprobada, proveedor, precio y origen.' },
    },
    { name: 'isFictional', label: 'Producto ficticio (demo)', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar' } },
  ],
}
