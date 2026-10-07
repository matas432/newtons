import { APIError, type CollectionBeforeChangeHook, type CollectionAfterChangeHook, type CollectionConfig } from 'payload'

import { canApprove, editorial, idOf, isStaffUser } from '@/access'
import { auditTrail } from '@/hooks/auditTrail'
import { AMOUNT_BASIS, AMOUNT_UNITS } from '@/lib/options'

/**
 * Formulación = composición exacta de un producto en una versión concreta.
 * Una formulación verificada no se modifica: un cambio de fórmula crea otra
 * versión y no altera el historial de ningún cliente.
 *
 * Verificar exige que cada ingrediente funcional esté en el pool de
 * conocimiento y tenga cantidad declarada: compartir molécula no valida por sí
 * solo un producto comercial (Libro 1 v2.0, cap. 2).
 */

const guardVerified: CollectionBeforeChangeHook = async ({ data, originalDoc, req, operation, context }) => {
  if (context?.skipGuards) return data
  const user = req.user
  if (operation === 'create' && data.product != null && data.version == null) {
    const existing = await req.payload.count({ collection: 'formulations', where: { product: { equals: idOf(data.product) } }, req })
    data.version = existing.totalDocs + 1
  }

  const becomesVerified = data.verificationStatus === 'verified' && originalDoc?.verificationStatus !== 'verified'
  if (becomesVerified) {
    if (!canApprove(user)) throw new APIError('Solo la revisión profesional puede verificar una composición.', 403, undefined, true)
    if (!data.source) throw new APIError('Una composición verificada necesita fuente.', 400, undefined, true)
    const rows = data.composition ?? []
    if (!rows.length) throw new APIError('Una composición verificada necesita al menos un ingrediente.', 400, undefined, true)
    const problems: string[] = []
    for (const row of rows) {
      const ing = await req.payload.findByID({ collection: 'ingredients', id: idOf(row.ingredient)!, depth: 0, req, overrideAccess: true })
      if (ing.poolStatus !== 'in-pool') problems.push(`«${ing.name}» no está en el pool`)
      if (row.amount == null || !row.unit) problems.push(`falta la cantidad de «${ing.name}»`)
    }
    if (problems.length) throw new APIError(`No se puede verificar: ${problems.join('; ')}.`, 400, undefined, true)
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
    const product = await req.payload.findByID({ collection: 'products', id: idOf(doc.product)!, depth: 0, req, overrideAccess: true })
    const previous = idOf(product.currentFormulation)
    if (previous != null && String(previous) !== String(doc.id)) {
      await req.payload.update({ collection: 'formulations', id: previous, data: { verificationStatus: 'superseded' }, req, overrideAccess: true, context: { skipGuards: true } })
    }
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
    // Composiciones verificadas: públicas. Pendientes o rechazadas: solo el equipo.
    read: ({ req: { user } }) => (isStaffUser(user) ? true : { verificationStatus: { in: ['verified', 'superseded'] } }),
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
      name: 'labelInfo',
      label: 'Indicaciones de la etiqueta',
      type: 'group',
      admin: { description: 'Lo que dice el fabricante. Se muestra al cliente como referencia; nunca se convierte en una pauta personal (Libro 1 v2.0, cap. 4).' },
      fields: [
        { name: 'directions', label: 'Modo de empleo según la etiqueta', type: 'textarea', localized: true },
        {
          type: 'row',
          fields: [
            { name: 'dailyUnitsMin', label: 'Unidades al día (mín.)', type: 'number', min: 0 },
            { name: 'dailyUnitsMax', label: 'Unidades al día (máx.)', type: 'number', min: 0 },
          ],
        },
        { name: 'warnings', label: 'Advertencias de la etiqueta', type: 'textarea', localized: true },
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
