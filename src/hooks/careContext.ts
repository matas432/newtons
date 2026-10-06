import { APIError, type CollectionBeforeChangeHook, type PayloadRequest } from 'payload'

import { chainOf, hasRole, idOf, isCustomer, isStaffUser } from '@/access'

/**
 * Copia cliente, cadena y establecimiento desde el documento padre. Así el
 * control de acceso por cadena funciona igual en planes, líneas, tomas,
 * revisiones y molestias, y nadie puede «mover» un registro a otra cadena.
 */
export const inheritFrom =
  (parentField: 'plan' | 'planItem', parentCollection: 'plans' | 'plan-items'): CollectionBeforeChangeHook =>
  async ({ data, originalDoc, req }) => {
    const parentId = idOf(data[parentField] ?? originalDoc?.[parentField])
    if (parentId == null) return data
    const parent = await req.payload.findByID({ collection: parentCollection, id: parentId, depth: 0, req, overrideAccess: true })
    data.customer = idOf(parent.customer)
    data.chain = idOf(parent.chain)
    data.store = idOf(parent.store)
    if (isCustomer(req.user) && String(data.customer) !== String(req.user.id)) {
      throw new APIError('Este registro no pertenece a tu plan.', 403, undefined, true)
    }
    if (isStaffUser(req.user) && !hasRole(req.user, 'newtons-admin') && String(data.chain) !== String(chainOf(req.user))) {
      throw new APIError('Este registro pertenece a otra cadena.', 403, undefined, true)
    }
    return data
  }

/**
 * Libro 2, n.º 21: cada modificación relevante guarda autor, fecha y motivo.
 * Al modificar un documento ya existente, el personal debe indicar un motivo
 * nuevo (distinto del anterior).
 */
export const requireChangeReason =
  (isDraft: (originalDoc: any, req: PayloadRequest) => boolean | Promise<boolean>): CollectionBeforeChangeHook =>
  async ({ data, originalDoc, operation, req }) => {
    if (operation !== 'update' || !isStaffUser(req.user)) return data
    if (await isDraft(originalDoc, req)) return data
    const reason = typeof data.changeReason === 'string' ? data.changeReason.trim() : ''
    if (!reason || reason === originalDoc?.changeReason) {
      throw new APIError('Indica el motivo del cambio.', 400, undefined, true)
    }
    return data
  }

/** Limita los campos que un cliente puede cambiar en un documento. */
export const customerMayOnlyChange =
  (allowed: string[]): CollectionBeforeChangeHook =>
  ({ data, originalDoc, operation, req }) => {
    if (operation !== 'update' || !isCustomer(req.user) || !originalDoc) return data
    for (const key of Object.keys(data)) {
      if (allowed.includes(key) || ['updatedAt', 'createdAt', 'id', 'customer', 'chain', 'store'].includes(key)) continue
      if (JSON.stringify(data[key]) !== JSON.stringify(originalDoc[key])) {
        throw new APIError(`No puedes modificar «${key}». Si tu pauta ha cambiado, regístralo como cambio declarado.`, 403, undefined, true)
      }
    }
    return data
  }
