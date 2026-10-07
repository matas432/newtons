import { APIError, type CollectionBeforeChangeHook, type CollectionConfig } from 'payload'

import { customersOnly, idOf, isCustomer, nobody, ownDataOnly } from '@/access'
import { auditTrail } from '@/hooks/auditTrail'
import { serverControlled, setOwner } from '@/hooks/careContext'

/**
 * «Mis productos» (Libro 1 v2.0, cap. 7 y 9). Una compra solo *sugiere* un
 * producto; el cliente lo confirma antes de poder registrarlo en su plan.
 * Solo admite productos con composición verificada y todos sus ingredientes
 * en el pool de conocimiento.
 */
const validate: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req }) => {
  if (operation === 'create') {
    const product = await req.payload.findByID({ collection: 'products', id: idOf(data.product)!, depth: 0, req, overrideAccess: true })
    data.formulation ??= idOf(product.currentFormulation)
    if (!data.formulation) throw new APIError('Este producto aún no tiene una composición verificada.', 400, undefined, true)
    const formulation = await req.payload.findByID({ collection: 'formulations', id: idOf(data.formulation)!, depth: 1, req, overrideAccess: true })
    if (formulation.verificationStatus !== 'verified' && formulation.verificationStatus !== 'superseded') {
      throw new APIError('La composición de este producto está pendiente de verificación.', 400, undefined, true)
    }
    const outside = (formulation.composition ?? []).filter((r) => typeof r.ingredient === 'object' && r.ingredient?.poolStatus !== 'in-pool')
    if (outside.length) throw new APIError('Este producto contiene ingredientes fuera del pool de Newtons.', 400, undefined, true)
    if (isCustomer(req.user)) data.source ??= 'added-by-customer'
  }
  if (data.status === 'active' && originalDoc?.status !== 'active') data.confirmedAt = new Date().toISOString()
  return data
}

export const CustomerProducts: CollectionConfig = {
  slug: 'customer-products',
  labels: { singular: 'Producto del cliente', plural: 'Mis productos' },
  admin: { group: 'Seguimiento del cliente', useAsTitle: 'id', defaultColumns: ['customer', 'product', 'status', 'source'] },
  access: { read: ownDataOnly(), create: customersOnly, update: ownDataOnly(), delete: nobody },
  hooks: { beforeChange: [setOwner, serverControlled(['source', 'order', 'submission', 'confirmedAt']), validate], afterChange: [auditTrail] },
  fields: [
    { name: 'customer', label: 'Cliente', type: 'relationship', relationTo: 'customers', required: true, index: true },
    {
      type: 'row',
      fields: [
        { name: 'product', label: 'Producto', type: 'relationship', relationTo: 'products', required: true },
        { name: 'formulation', label: 'Composición (versión)', type: 'relationship', relationTo: 'formulations', admin: { description: 'La del envase del cliente. No cambia sola si el fabricante cambia la fórmula.' } },
      ],
    },
    {
      name: 'status',
      label: 'Estado',
      type: 'select',
      required: true,
      defaultValue: 'suggested',
      options: [
        { label: 'Sugerido (compra recibida, sin confirmar)', value: 'suggested' },
        { label: 'Confirmado por el cliente', value: 'active' },
        { label: 'Archivado', value: 'archived' },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'source',
          label: 'Origen',
          type: 'select',
          options: [
            { label: 'Compra en Newtons', value: 'purchase' },
            { label: 'Producto externo verificado', value: 'external' },
            { label: 'Añadido por el cliente', value: 'added-by-customer' },
          ],
        },
        { name: 'order', label: 'Pedido', type: 'relationship', relationTo: 'orders' },
        { name: 'submission', label: 'Solicitud de producto externo', type: 'relationship', relationTo: 'product-submissions' },
      ],
    },
    { name: 'confirmedAt', label: 'Confirmado el', type: 'date', admin: { readOnly: true } },
  ],
}
