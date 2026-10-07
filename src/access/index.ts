import type { Access, PayloadRequest } from 'payload'

/**
 * Roles del equipo Newtons (colección `users`). Los clientes viven en la
 * colección `customers` y nunca entran al panel de administración.
 * Libro 1 v2.0, cap. 13.
 */
export const ROLES = [
  { label: 'Administración técnica', value: 'admin' },
  { label: 'Editorial', value: 'editor' },
  { label: 'Revisión profesional', value: 'reviewer' },
  { label: 'Operaciones (pedidos, stock, envíos)', value: 'operations' },
  { label: 'Soporte', value: 'support' },
] as const

export type Role = (typeof ROLES)[number]['value']

type AnyUser = PayloadRequest['user']

type StaffUser = { collection: 'users'; id: number | string; role?: Role | null }
type CustomerUser = { collection: 'customers'; id: number | string }

/** Devuelve el id (numérico en PostgreSQL) de una relación, esté poblada o no. */
export const idOf = (value: unknown): number | undefined => {
  if (value == null || value === '') return undefined
  const raw = typeof value === 'object' && 'id' in (value as object) ? (value as { id: number | string }).id : (value as number | string)
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

export const isStaffUser = (user: AnyUser): user is AnyUser & StaffUser => user?.collection === 'users'

export const isCustomer = (user: AnyUser): user is AnyUser & CustomerUser => user?.collection === 'customers'

export const hasRole = (user: AnyUser, ...roles: Role[]): boolean =>
  isStaffUser(user) && !!user.role && roles.includes(user.role)

export const isEditorial = (user: AnyUser) => hasRole(user, 'admin', 'editor', 'reviewer')
export const canApprove = (user: AnyUser) => hasRole(user, 'admin', 'reviewer')
export const isOperations = (user: AnyUser) => hasRole(user, 'admin', 'operations')

// ---------------------------------------------------------------- access helpers

export const anyone: Access = () => true
export const nobody: Access = () => false
export const admin: Access = ({ req: { user } }) => hasRole(user, 'admin')
export const editorial: Access = ({ req: { user } }) => isEditorial(user)
export const operations: Access = ({ req: { user } }) => isOperations(user)
export const anyStaff: Access = ({ req: { user } }) => isStaffUser(user)

/** Conocimiento: el equipo lo ve todo; el resto, solo lo aprobado. */
export const approvedOrStaff: Access = ({ req: { user } }) =>
  isStaffUser(user) ? true : { editorialStatus: { equals: 'approved' } }

/**
 * Datos personales de seguimiento (productos registrados, plan, tomas,
 * revisiones, molestias): solo el propio cliente. Ningún rol del equipo —ni
 * operaciones, ni editorial, ni administración— los ve por defecto
 * (Libro 1 v2.0, cap. 13). Un acceso de soporte para una incidencia concreta
 * se diseñará aparte, con autorización y registro.
 */
export const ownDataOnly =
  (customerField = 'customer'): Access =>
  ({ req: { user } }) =>
    isCustomer(user) ? { [customerField]: { equals: user.id } } : false

/** Crear datos de seguimiento: solo clientes (el hook fija el propietario). */
export const customersOnly: Access = ({ req: { user } }) => isCustomer(user)

/** Oculta una colección del panel salvo para los roles indicados. */
export const hiddenUnless =
  (...roles: Role[]) =>
  ({ user }: { user: unknown }) =>
    !hasRole(user as AnyUser, ...roles)

/** Como `idOf`, pero falla si la relación está vacía (para relaciones obligatorias). */
export const mustId = (value: unknown): number => {
  const id = idOf(value)
  if (id == null) throw new Error('Relación obligatoria sin identificador.')
  return id
}
