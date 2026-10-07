import type { CollectionSlug, Payload } from 'payload'

/** Orden de borrado: primero lo que depende de otros documentos. */
const ORDER: CollectionSlug[] = [
  'audit-log',
  'symptom-reports',
  'reviews',
  'intake-logs',
  'plan-items',
  'plans',
  'customer-products',
  'product-submissions',
  'private-files',
  'payment-events',
  'stock-movements',
  'orders',
  'lots',
  'consents',
  'customers',
  'formulations',
  'products',
  'suppliers',
  'ingredients',
  'sources',
  'users',
  'blocks',
  'rhythms',
  'domains',
]

export async function resetDatabase(payload: Payload) {
  // Romper la referencia circular producto ↔ formulación antes de borrar.
  await payload.update({ collection: 'products', where: { id: { exists: true } }, data: { currentFormulation: null }, overrideAccess: true, context: { skipGuards: true } })
  for (const collection of ORDER) {
    await payload.delete({ collection, where: { id: { exists: true } }, overrideAccess: true })
  }
}
