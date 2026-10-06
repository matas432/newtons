import type { CollectionAfterChangeHook, CollectionConfig } from 'payload'
import type { AccessResult } from 'payload'

import { chainOf, hasPermission, hasRole, idOf, isCustomer, nobody } from '@/access'
import { auditTrail } from '@/hooks/auditTrail'
import { forceOwnChain } from '@/hooks/forceOwnChain'

/**
 * Vinculación privada entre un cliente y una droguería (Libro 2, n.º 2 y 5).
 * Define qué comparte el cliente con esa cadena. El QR público no da acceso a
 * nada: la vinculación requiere una cuenta autenticada.
 */
const syncLinkedChains: CollectionAfterChangeHook = async ({ doc, req }) => {
  const customerId = idOf(doc.customer)!
  const active = await req.payload.find({
    collection: 'customer-links',
    where: { and: [{ customer: { equals: customerId } }, { status: { equals: 'active' } }] },
    depth: 0,
    limit: 100,
    req,
    overrideAccess: true,
  })
  await req.payload.update({
    collection: 'customers',
    id: customerId,
    data: { linkedChains: [...new Set(active.docs.map((l) => idOf(l.chain)))] as number[] },
    req,
    overrideAccess: true,
  })
  return doc
}

export const CustomerLinks: CollectionConfig = {
  slug: 'customer-links',
  labels: { singular: 'Vinculación', plural: 'Vinculaciones' },
  admin: { group: 'Clientes y planes', useAsTitle: 'id', defaultColumns: ['customer', 'chain', 'store', 'status'] },
  access: {
    read: ({ req: { user } }): AccessResult => {
      if (isCustomer(user)) return { customer: { equals: user.id } }
      if (hasRole(user, 'chain-admin')) return { chain: { equals: chainOf(user) } }
      if (hasRole(user, 'staff')) return { chain: { equals: chainOf(user) } }
      return hasRole(user, 'newtons-admin')
    },
    create: nobody,
    update: ({ req: { user } }): AccessResult => {
      if (isCustomer(user)) return { customer: { equals: user.id } }
      if (hasPermission(user, 'invite')) return { chain: { equals: chainOf(user) } }
      return false
    },
    delete: nobody,
  },
  hooks: { beforeChange: [forceOwnChain], afterChange: [syncLinkedChains, auditTrail] },
  fields: [
    { name: 'customer', label: 'Cliente', type: 'relationship', relationTo: 'customers', required: true, index: true },
    { name: 'chain', label: 'Cadena', type: 'relationship', relationTo: 'chains', required: true, index: true },
    { name: 'store', label: 'Establecimiento de referencia', type: 'relationship', relationTo: 'stores', required: true },
    {
      name: 'status',
      label: 'Estado',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Activa', value: 'active' },
        { label: 'Revocada por el cliente', value: 'revoked' },
        { label: 'Finalizada', value: 'ended' },
      ],
    },
    {
      name: 'sharing',
      label: 'Qué comparte el cliente con la droguería',
      type: 'select',
      hasMany: true,
      defaultValue: ['plan', 'intake-logs', 'reviews', 'symptom-reports'],
      options: [
        { label: 'Plan', value: 'plan' },
        { label: 'Registro de tomas', value: 'intake-logs' },
        { label: 'Revisiones', value: 'reviews' },
        { label: 'Molestias', value: 'symptom-reports' },
      ],
    },
    { name: 'identityVerified', label: 'Identidad comprobada en el establecimiento', type: 'checkbox', defaultValue: false },
    { name: 'invitedBy', label: 'Invitado por', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
    { name: 'endedAt', label: 'Finalizada el', type: 'date', admin: { readOnly: true } },
  ],
}
