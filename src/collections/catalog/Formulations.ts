import { APIError, type CollectionBeforeChangeHook, type CollectionAfterChangeHook, type CollectionConfig } from 'payload'

import { anyStaff, canApprove, editorial, idOf, isCustomer, isStaffUser } from '@/access'
import { auditTrail } from '@/hooks/auditTrail'
import { AMOUNT_BASIS, AMOUNT_UNITS } from '@/lib/options'

/**
 * Formulación = composición exacta de un producto en una versión concreta.
 * Una formulación verificada no se modifica: un cambio de fórmula crea otra
 * versión y no altera el historial de ningún cliente (Libro 2, n.º 10).
 */

const guardVerified: CollectionBeforeChangeHook = async ({ data, originalDoc, req, operation }) => {
  const user = req.user
  if (operation === 'create' && data.product != null && data.version == null) {
    const existing = await req.payload.count({ collection: 'formulations', where: { product: { equals: idOf(data.product) } }, req })
    data.version = existing.totalDocs + 1
  }

  const becomesVerified = data.verificationStatus === 'verified' && originalDoc?.verificationStatus !== 'verified'
  if (becomesVerified) {
    if (!canApprove(user)) throw new APIError('Solo la revisión profesional puede verificar una composición.', 403, undefined, true)
    if (!data.source) throw new APIError('Una composición verificada necesita fuente.', 400, undefined, true)
    if (isStaffUser(user)) data.verifiedBy = user.id
    data.verifiedAt = new Date().toISOString()
  }

  if (originalDoc?.verificationStatus === 'verified' && operation === 'update') {
    const before = JSON.stringify(normalize(originalDoc.composition))
    const after = JSON.stringify(normalize(data.composition ?? originalDoc.composition))
    if (before !== after) {
      throw new APIError('Esta formulación está verificada. Para cambiar la composición, crea una versión nueva.', 400, undefined, true)
    }
  }
  return data
}

const normalize = (rows: any[] | undefined) =>
  (rows ?? []).map((r) => [idOf(r.ingredient), r.amount, r.unit, r.basis, r.chemicalForm ?? null])

const promoteToCurrent: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  if (doc.verificationStatus === 'verified' && previousDoc?.verificationStatus !== 'verified') {
    await req.payload.update({
      collection: 'products',
      id: idOf(doc.product)!,
      data: { currentFormulation: doc.id },
      req,
      overrideAccess: true,
    })
  }
  return doc
}

export const Formulations: CollectionConfig = {
  slug: 'formulations',
  labels: { singular: 'Formulación', plural: 'Formulaciones' },
  admin: { group: 'Catálogo', useAsTitle: 'label', defaultColumns: ['label', 'product', 'version', 'verificationStatus'] },
  access: {
    read: (args) => (isCustomer(args.req.user) ? true : anyStaff(args)),
    create: editorial,
    update: editorial,
    delete: editorial,
  },
  hooks: {
    beforeChange: [guardVerified],
    afterChange: [promoteToCurrent, auditTrail],
  },
  fields: [
    { name: 'product', label: 'Producto', type: 'relationship', relationTo: 'products', required: true },
    {
      name: 'label',
      label: 'Etiqueta interna',
      type: 'text',
      admin: { readOnly: true },
      hooks: {
        beforeChange: [
          async ({ siblingData, req }) => {
            const product = siblingData.product
              ? await req.payload.findByID({ collection: 'products', id: idOf(siblingData.product)!, depth: 0, req, overrideAccess: true })
              : null
            return `${product?.name ?? 'Producto'} · v${siblingData.version ?? '?'}`
          },
        ],
      },
    },
    {
      type: 'row',
      fields: [
        { name: 'version', label: 'Versión', type: 'number', admin: { readOnly: true } },
        { name: 'validFrom', label: 'Vigente desde', type: 'date', admin: { date: { pickerAppearance: 'dayOnly' } } },
      ],
    },
    {
      name: 'composition',
      label: 'Composición por unidad de toma',
      type: 'array',
      minRows: 1,
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'ingredient', label: 'Ingrediente', type: 'relationship', relationTo: 'ingredients', required: true },
            { name: 'amount', label: 'Cantidad', type: 'number', min: 0, admin: { description: 'Vacío si la etiqueta no la declara.' } },
            { name: 'unit', label: 'Unidad', type: 'select', options: AMOUNT_UNITS },
            { name: 'basis', label: 'Referida a', type: 'select', required: true, defaultValue: 'active', options: AMOUNT_BASIS },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'chemicalForm', label: 'Forma química', type: 'text', admin: { description: 'p. ej. «citrato de magnesio», «colecalciferol»' } },
            { name: 'extractDetails', label: 'Extracto: especie, parte, DER, solvente, estandarización', type: 'text' },
          ],
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'excipients', label: 'Excipientes', type: 'textarea' },
        { name: 'allergens', label: 'Alérgenos declarados', type: 'textarea' },
      ],
    },
    {
      name: 'verificationStatus',
      label: 'Verificación',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pendiente', value: 'pending' },
        { label: 'Verificada', value: 'verified' },
        { label: 'Rechazada', value: 'rejected' },
        { label: 'Sustituida por otra versión', value: 'superseded' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'source', label: 'Fuente de la composición', type: 'text', admin: { position: 'sidebar', description: 'Etiqueta, ficha del fabricante, archivo de la droguería…' } },
    { name: 'sourceDate', label: 'Fecha de la fuente', type: 'date', admin: { position: 'sidebar', date: { pickerAppearance: 'dayOnly' } } },
    { name: 'verifiedBy', label: 'Verificada por', type: 'relationship', relationTo: 'users', admin: { position: 'sidebar', readOnly: true } },
    { name: 'verifiedAt', label: 'Verificada el', type: 'date', admin: { position: 'sidebar', readOnly: true } },
  ],
}
