import { APIError, type CollectionBeforeChangeHook } from 'payload'

import { canApprove, isStaffUser } from '@/access'

/** Campos que una ficha necesita antes de poder aprobarse. */
const REQUIRED_FOR_APPROVAL: Array<[string, (doc: Record<string, any>) => boolean]> = [
  ['Resumen en una frase', (d) => !!d.summary],
  ['Qué es (breve)', (d) => !!d.whatIsShort],
  ['Dominio principal', (d) => d.primaryDomain != null],
  ['Mecanismos principales', (d) => !!d.mechanisms],
  ['Objetivo funcional — vida cotidiana', (d) => !!d.goalEveryday],
  ['Pregunta de revisión', (d) => !!d.reviewQuestion],
  ['Bloque', (d) => d.block != null],
  ['Ritmo', (d) => d.rhythm != null],
  ['Tolerabilidad habitual', (d) => !!d.tolerability],
  ['Resumen de alerta evaluado', (d) => !!d.alertSummary?.status && d.alertSummary.status !== 'not-evaluated'],
  ['Resumen de interacciones evaluado', (d) => !!d.interactionSummary?.status && d.interactionSummary.status !== 'not-evaluated'],
  ['Nivel de evidencia', (d) => !!d.evidenceSummary],
  ['Qué observar (al menos 2)', (d) => (d.observations?.length ?? 0) >= 2],
  ['Fuentes (al menos 1)', (d) => (d.sources?.length ?? 0) >= 1],
]

/**
 * Flujo editorial de las fichas:
 * - solo revisión profesional o administración pueden aprobar;
 * - aprobar exige los campos esenciales completos;
 * - si alguien sin permiso de aprobación modifica una ficha aprobada, vuelve
 *   a «en revisión» en lugar de cambiar en silencio el contenido publicado.
 */
export const editorialWorkflow: CollectionBeforeChangeHook = ({ data, originalDoc, req, operation }) => {
  const user = req.user
  if (operation === 'create' && isStaffUser(user) && data.author == null) data.author = user.id

  const wasApproved = originalDoc?.editorialStatus === 'approved'
  const wantsApproved = data.editorialStatus === 'approved'

  if (wantsApproved && !canApprove(user)) {
    if (wasApproved && user) {
      data.editorialStatus = 'in-review'
      data.reviewer = null
      data.approvedAt = null
      return data
    }
    throw new APIError('Solo la revisión profesional puede aprobar una ficha.', 403, undefined, true)
  }

  if (wantsApproved && !wasApproved) {
    const doc = { ...(originalDoc ?? {}), ...data }
    const missing = REQUIRED_FOR_APPROVAL.filter(([, ok]) => !ok(doc)).map(([label]) => label)
    if (missing.length) {
      throw new APIError(`No se puede aprobar. Faltan: ${missing.join(', ')}.`, 400, undefined, true)
    }
    if (isStaffUser(user)) data.reviewer = user.id
    data.approvedAt = new Date().toISOString()
  }

  return data
}
