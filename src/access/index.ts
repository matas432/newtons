import type { Access, PayloadRequest, Where } from 'payload'

/**
 * Roles del personal (colección `users`). Los clientes viven en la colección
 * `customers` y nunca entran al panel de administración.
 */
export const ROLES = [
  { label: 'Administración Newtons', value: 'newtons-admin' },
  { label: 'Editorial Newtons', value: 'editor' },
  { label: 'Revisión profesional Newtons', value: 'reviewer' },
  { label: 'Administración de la cadena', value: 'chain-admin' },
  { label: 'Personal de droguería', value: 'staff' },
] as const

export type Role = (typeof ROLES)[number]['value']

/** Libro 2, n.º 21: invitar, preparar y confirmar son funciones separadas. */
export const STAFF_PERMISSIONS = [
  { label: 'Gestionar invitaciones', value: 'invite' },
  { label: 'Preparar planes', value: 'prepare-plans' },
  { label: 'Confirmar planes (profesional autorizado)', value: 'confirm-plans' },
  { label: 'Ver información compartida por el cliente', value: 'view-shared-data' },
] as const

export type StaffPermission = (typeof STAFF_PERMISSIONS)[number]['value']

type AnyUser = PayloadRequest['user']

type StaffUser = {
  collection: 'users'
  id: number | string
  role?: Role | null
  chain?: unknown
  stores?: unknown[] | null
  permissions?: StaffPermission[] | null
}

type CustomerUser = { collection: 'customers'; id: number | string }

/** Devuelve el id de una relación, esté poblada o no. */
export const idOf = (value: unknown): number | string | undefined => {
  if (value == null) return undefined
  if (typeof value === 'object' && 'id' in (value as object)) {
    return (value as { id: number | string }).id
  }
  return value as number | string
}

export const isStaffUser = (user: AnyUser): user is AnyUser & StaffUser =>
  user?.collection === 'users'

export const isCustomer = (user: AnyUser): user is AnyUser & CustomerUser =>
  user?.collection === 'customers'

export const hasRole = (user: AnyUser, ...roles: Role[]): boolean =>
  isStaffUser(user) && !!user.role && roles.includes(user.role)

export const hasPermission = (user: AnyUser, permission: StaffPermission): boolean =>
  hasRole(user, 'staff') && !!(user as StaffUser).permissions?.includes(permission)

export const chainOf = (user: AnyUser) =>
  isStaffUser(user) ? idOf(user.chain) : undefined

export const storesOf = (user: AnyUser) =>
  isStaffUser(user) ? (user.stores ?? []).map(idOf).filter((id) => id != null) : []

export const isEditorial = (user: AnyUser) => hasRole(user, 'newtons-admin', 'editor', 'reviewer')
export const canApprove = (user: AnyUser) => hasRole(user, 'newtons-admin', 'reviewer')

// ---------------------------------------------------------------- access helpers

export const anyone: Access = () => true
export const nobody: Access = () => false
export const newtonsAdmin: Access = ({ req: { user } }) => hasRole(user, 'newtons-admin')
export const editorial: Access = ({ req: { user } }) => isEditorial(user)
export const anyStaff: Access = ({ req: { user } }) => isStaffUser(user)

/** Conocimiento: el personal lo ve todo; el resto, solo lo aprobado. */
export const approvedOrStaff: Access = ({ req: { user } }) =>
  isStaffUser(user) ? true : { editorialStatus: { equals: 'approved' } }

/** Documentos de una cadena: administración Newtons o la propia cadena. */
export const ownChain =
  (field = 'chain', roles: Role[] = ['chain-admin']): Access =>
  ({ req: { user } }) => {
    if (hasRole(user, 'newtons-admin')) return true
    const chain = chainOf(user)
    if (chain != null && hasRole(user, ...roles)) return { [field]: { equals: chain } }
    return false
  }

/**
 * Datos de salud (planes, tomas, revisiones, molestias). Libro 2, n.º 33: la
 * administración de la cadena y la de Newtons NO los ven por defecto. Acceden
 * el propio cliente y el personal con el permiso correspondiente, limitado a
 * su cadena y a sus establecimientos.
 */
export const healthData =
  (permission: StaffPermission, opts: { customerField?: string } = {}): Access =>
  ({ req: { user } }) => {
    const customerField = opts.customerField ?? 'customer'
    if (isCustomer(user)) return { [customerField]: { equals: user.id } }
    if (hasPermission(user, permission)) {
      const where: Where[] = [{ chain: { equals: chainOf(user) } }]
      const stores = storesOf(user)
      if (stores.length) where.push({ store: { in: stores } })
      return { and: where }
    }
    return false
  }

/** Acceso de lectura a datos de salud: cualquier permiso de atención basta. */
export const healthDataRead =
  (opts: { customerField?: string } = {}): Access =>
  (args) => {
    const { user } = args.req
    if (isCustomer(user)) return healthData('view-shared-data', opts)(args)
    for (const p of ['view-shared-data', 'prepare-plans', 'confirm-plans'] as const) {
      if (hasPermission(user, p)) return healthData(p, opts)(args)
    }
    return false
  }

/** Oculta una colección del panel salvo para los roles indicados. */
export const hiddenUnless =
  (...roles: Role[]) =>
  ({ user }: { user: unknown }) =>
    !hasRole(user as AnyUser, ...roles)

/** Crear en una cadena: Newtons o la administración de la cadena. */
export const chainAdminCreate: Access = ({ req: { user } }) => hasRole(user, 'newtons-admin', 'chain-admin')
