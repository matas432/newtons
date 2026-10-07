import { APIError, type CollectionBeforeChangeHook } from 'payload'

import { idOf, isCustomer } from '@/access'

/**
 * Los datos de seguimiento pertenecen a un cliente. Al crear, el propietario
 * es siempre quien crea; al modificar, el propietario no cambia.
 */
export const setOwner: CollectionBeforeChangeHook = ({ data, originalDoc, operation, req }) => {
  if (operation === 'create' && isCustomer(req.user)) data.customer = req.user.id
  if (operation === 'update' && originalDoc) data.customer = idOf(originalDoc.customer)
  return data
}

/**
 * Copia el cliente desde el documento padre (p. ej. la línea del plan de una
 * toma) y comprueba que pertenece a quien escribe.
 */
export const inheritCustomer =
  (parentField: string, parentCollection: 'plans' | 'plan-items' | 'customer-products'): CollectionBeforeChangeHook =>
  async ({ data, originalDoc, req }) => {
    const parentId = idOf(data[parentField] ?? originalDoc?.[parentField])
    if (parentId == null) return data
    const parent = await req.payload.findByID({ collection: parentCollection, id: parentId, depth: 0, req, overrideAccess: true })
    data.customer = idOf(parent.customer)
    if (isCustomer(req.user) && String(data.customer) !== String(req.user.id)) {
      throw new APIError('Este registro no pertenece a tu cuenta.', 403, undefined, true)
    }
    return data
  }

/**
 * Campos que fija el sistema o el equipo, nunca el cliente (p. ej. la revisión
 * profesional: no debe poder «aparecer» si no ha ocurrido).
 */
export const serverControlled =
  (fields: string[]): CollectionBeforeChangeHook =>
  ({ data, originalDoc, operation, req, context }) => {
    // Escrituras internas del sistema (p. ej. crear el plan o las revisiones previstas).
    if (context?.system || !isCustomer(req.user)) return data
    for (const f of fields) {
      if (operation === 'update') data[f] = originalDoc?.[f]
      else delete data[f]
    }
    return data
  }
