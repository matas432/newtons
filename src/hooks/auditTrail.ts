import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

const IGNORED = new Set(['updatedAt', 'createdAt', 'id', 'label'])

/** Nombres de los campos de primer nivel que cambiaron (sin valores: minimización). */
export const changedFields = (before: Record<string, unknown> | undefined, after: Record<string, unknown>) => {
  if (!before) return []
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  return [...keys].filter((k) => !IGNORED.has(k) && JSON.stringify(before[k]) !== JSON.stringify(after[k]))
}

const actorOf = (user: any) =>
  user ? { actorCollection: user.collection as string, actorId: String(user.id) } : { actorCollection: 'system', actorId: '' }

/**
 * Registro de cambios: quién, cuándo, qué campos y con qué motivo
 * (Libro 1, cap. 10; Libro 2, n.º 21). No guarda los valores, solo los nombres
 * de los campos, para no duplicar datos de salud en el registro.
 */
export const auditTrail: CollectionAfterChangeHook = async ({ collection, doc, previousDoc, operation, req }) => {
  const fields = operation === 'create' ? [] : changedFields(previousDoc, doc)
  if (operation === 'update' && fields.length === 0) return doc
  await req.payload.create({
    collection: 'audit-log',
    data: {
      targetCollection: collection.slug,
      targetId: String(doc.id),
      operation,
      changedFields: fields,
      reason: typeof doc.changeReason === 'string' ? doc.changeReason : undefined,
      ...actorOf(req.user),
    },
    req,
    overrideAccess: true,
  })
  return doc
}

export const auditDelete: CollectionAfterDeleteHook = async ({ collection, doc, req }) => {
  await req.payload.create({
    collection: 'audit-log',
    data: { targetCollection: collection.slug, targetId: String(doc.id), operation: 'delete', changedFields: [], ...actorOf(req.user) },
    req,
    overrideAccess: true,
  })
  return doc
}
