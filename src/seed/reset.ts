import type { CollectionSlug, Payload } from 'payload'

/** Orden de borrado: primero lo que depende de otros documentos. */
const ORDER: CollectionSlug[] = [
  'audit-log',
  'symptom-reports',
  'reviews',
  'intake-logs',
  'plan-items',
  'plans',
  'consents',
  'invitations',
  'customer-links',
  'customers',
  'assortment',
  'formulations',
  'products',
  'ingredients',
  'sources',
  'users',
  'stores',
  'chains',
  'blocks',
  'rhythms',
  'domains',
]

export async function resetDatabase(payload: Payload) {
  for (const collection of ORDER) {
    await payload.delete({ collection, where: { id: { exists: true } }, overrideAccess: true })
  }
}
