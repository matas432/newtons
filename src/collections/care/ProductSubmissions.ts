import { APIError, type CollectionAfterChangeHook, type CollectionBeforeChangeHook, type CollectionConfig } from 'payload'

import { canApprove, customersOnly, idOf, isCustomer, isEditorial, mustId, nobody } from '@/access'
import { auditTrail } from '@/hooks/auditTrail'
import { serverControlled, setOwner } from '@/hooks/careContext'

/**
 * Producto comprado en otro lugar (decisión del 7-10-2026). El cliente aporta
 * datos y fotos; queda «pendiente de verificación». Si declara un ingrediente
 * fuera del pool, se registra como solicitud de ampliación del catálogo y no
 * entra en su plan. Compartir molécula no valida por sí solo el producto.
 */
const classify: CollectionBeforeChangeHook = ({ data, operation }) => {
  if (operation === 'create') {
    data.status = data.otherIngredients?.trim() ? 'out-of-pool' : 'pending-verification'
  }
  return data
}

const verify: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req }) => {
  if (operation !== 'update' || data.status === originalDoc?.status) return data
  if (!isEditorial(req.user)) throw new APIError('Solo el equipo editorial cambia el estado.', 403, undefined, true)
  if (data.status === 'verified') {
    if (!canApprove(req.user)) throw new APIError('Verificar requiere rol de revisión.', 403, undefined, true)
    if (!data.resultProduct) throw new APIError('Vincula el producto verificado (con su composición verificada).', 400, undefined, true)
    const product = await req.payload.findByID({ collection: 'products', id: idOf(data.resultProduct)!, depth: 1, req, overrideAccess: true })
    const formulation = typeof product.currentFormulation === 'object' ? product.currentFormulation : null
    if (formulation?.verificationStatus !== 'verified') {
      throw new APIError('El producto vinculado no tiene una composición verificada.', 400, undefined, true)
    }
    data.verifiedAt = new Date().toISOString()
  }
  return data
}

const offerToCustomer: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  if (doc.status !== 'verified' || previousDoc?.status === 'verified') return doc
  await req.payload.create({
    collection: 'customer-products',
    context: { system: true },
    data: { customer: mustId(doc.customer), product: mustId(doc.resultProduct), source: 'external', submission: doc.id, status: 'suggested' },
    req,
    overrideAccess: true,
  })
  return doc
}

export const ProductSubmissions: CollectionConfig = {
  slug: 'product-submissions',
  labels: { singular: 'Producto externo enviado', plural: 'Productos externos enviados' },
  admin: { group: 'Catálogo', useAsTitle: 'productName', defaultColumns: ['productName', 'manufacturer', 'status', 'createdAt'] },
  access: {
    read: ({ req: { user } }) => (isCustomer(user) ? { customer: { equals: user.id } } : isEditorial(user)),
    create: customersOnly,
    update: ({ req: { user } }) => isEditorial(user),
    delete: nobody,
  },
  hooks: {
    beforeChange: [setOwner, serverControlled(['status', 'resultProduct', 'reviewNote', 'verifiedAt']), classify, verify],
    afterChange: [offerToCustomer, auditTrail],
  },
  fields: [
    {
      name: 'customer',
      label: 'Cliente',
      type: 'relationship',
      relationTo: 'customers',
      required: true,
      // El equipo editorial verifica el producto, no necesita saber de quién es.
      access: { read: ({ req: { user } }) => isCustomer(user) },
    },
    {
      type: 'row',
      fields: [
        { name: 'productName', label: 'Nombre del producto', type: 'text', required: true },
        { name: 'manufacturer', label: 'Fabricante', type: 'text', required: true },
      ],
    },
    {
      name: 'declaredIngredients',
      label: 'Ingredientes declarados (del pool)',
      type: 'array',
      minRows: 1,
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'ingredient', label: 'Ingrediente', type: 'relationship', relationTo: 'ingredients', required: true, filterOptions: { poolStatus: { equals: 'in-pool' } } },
            { name: 'amountText', label: 'Cantidad por unidad (según etiqueta)', type: 'text' },
          ],
        },
      ],
    },
    { name: 'otherIngredients', label: 'Otros ingredientes activos (fuera del pool)', type: 'textarea', admin: { description: 'Si se rellena, el producto no se incorpora al plan: queda como solicitud de ampliación del catálogo.' } },
    { name: 'photos', label: 'Fotos de la etiqueta', type: 'upload', relationTo: 'private-files', hasMany: true },
    {
      name: 'status',
      label: 'Estado',
      type: 'select',
      required: true,
      defaultValue: 'pending-verification',
      options: [
        { label: 'Pendiente de verificación', value: 'pending-verification' },
        { label: 'Verificado', value: 'verified' },
        { label: 'No verificable', value: 'rejected' },
        { label: 'Fuera del pool: solicitud de ampliación', value: 'out-of-pool' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'resultProduct', label: 'Producto verificado', type: 'relationship', relationTo: 'products', admin: { position: 'sidebar', description: 'Producto (tipo «externo») con su composición verificada: producto, fabricante, molécula, forma, cantidad, composición, etiqueta y versión.' } },
    { name: 'reviewNote', label: 'Nota para el cliente', type: 'textarea', admin: { position: 'sidebar' } },
    { name: 'verifiedAt', label: 'Verificado el', type: 'date', admin: { position: 'sidebar', readOnly: true } },
  ],
}
