import type { CollectionBeforeChangeHook } from 'payload'

import { chainOf, hasRole, isStaffUser } from '@/access'

/** El personal de una cadena solo puede crear o mover documentos dentro de su cadena. */
export const forceOwnChain: CollectionBeforeChangeHook = ({ data, req }) => {
  if (isStaffUser(req.user) && !hasRole(req.user, 'newtons-admin')) data.chain = chainOf(req.user)
  return data
}
