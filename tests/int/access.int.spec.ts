import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { resetDatabase } from '@/seed/reset'

/**
 * Criterios de aceptación del Libro 2: «Se prueba que una cadena no puede leer
 * datos de otra y que los cambios del plan dejan registro», más las reglas de
 * aprobación, verificación y permisos por función.
 */

let payload: Payload
const as = (collection: 'users' | 'customers', doc: any) => ({ ...doc, collection })

const f: Record<string, any> = {}

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  await resetDatabase(payload)
  const create = (collection: any, data: any, user?: any) => payload.create({ collection, data, overrideAccess: true, user } as any) as Promise<any>

  const domain = await create('domains', { code: 'DF-4', clientName: 'Iniciativa', technicalName: 'Iniciación', order: 1 })
  const rhythm = await create('rhythms', { code: 'cultivo', name: 'Cultivo', useWeeks: 12, pauseWeeks: 4 })
  const block = await create('blocks', { code: 'A', name: 'Ayunas', defaultTime: '07:30', order: 1 })

  f.editor = as('users', await create('users', { name: 'Ed', email: 'ed@t.test', password: 'test-password', role: 'editor' }))
  f.reviewer = as('users', await create('users', { name: 'Rev', email: 'rev@t.test', password: 'test-password', role: 'reviewer' }))

  f.ingredient = await create('ingredients', { name: 'Prueba', slug: 'prueba', category: 'other', primaryDomain: domain.id, block: block.id, rhythm: rhythm.id, reviewQuestion: '¿Cambió algo?' }, f.editor)
  f.product = await create('products', { name: 'Producto prueba', form: 'capsule', servingUnit: 'cápsula' })
  f.formulation = await create(
    'formulations',
    { product: f.product.id, composition: [{ ingredient: f.ingredient.id, amount: 100, unit: 'mg', basis: 'active' }], verificationStatus: 'verified', source: 'Etiqueta' },
    f.reviewer,
  )

  for (const n of [1, 2]) {
    const chain = await create('chains', { name: `Cadena ${n}`, slug: `cadena-${n}`, branding: { displayName: `Cadena ${n}` } })
    const store = await create('stores', { chain: chain.id, name: `Tienda ${n}` })
    const pro = as(
      'users',
      await create('users', { name: `Pro ${n}`, email: `pro${n}@t.test`, password: 'test-password', role: 'staff', chain: chain.id, stores: [store.id], permissions: ['prepare-plans', 'confirm-plans', 'view-shared-data', 'invite'] }),
    )
    f[`chain${n}`] = chain
    f[`store${n}`] = store
    f[`pro${n}`] = pro
  }
  f.chainAdmin1 = as('users', await create('users', { name: 'Admin 1', email: 'admin1@t.test', password: 'test-password', role: 'chain-admin', chain: f.chain1.id }))
  f.counter1 = as(
    'users',
    await create('users', { name: 'Mostrador 1', email: 'm1@t.test', password: 'test-password', role: 'staff', chain: f.chain1.id, stores: [f.store1.id], permissions: ['invite', 'prepare-plans'] }),
  )

  f.ana = as('customers', await create('customers', { alias: 'Ana', email: 'ana@t.test', password: 'test-password', adultConfirmed: true }))
  f.bea = as('customers', await create('customers', { alias: 'Bea', email: 'bea@t.test', password: 'test-password', adultConfirmed: true }))
  await create('customer-links', { customer: f.ana.id, chain: f.chain1.id, store: f.store1.id, status: 'active' })
  await create('customer-links', { customer: f.bea.id, chain: f.chain2.id, store: f.store2.id, status: 'active' })

  f.plan = await create('plans', { title: 'Plan de Ana', customer: f.ana.id, status: 'active' }, f.pro1)
  f.item = await create('plan-items', { plan: f.plan.id, product: f.product.id, servingsPerIntake: 2, rhythm: rhythm.id, startDate: '2026-10-01', scheduleType: 'daily' }, f.pro1)
}, 60_000)

afterAll(async () => {
  await resetDatabase(payload)
})

const read = (collection: any, user: any) => payload.find({ collection, user, overrideAccess: false, depth: 0 })

describe('separación entre cadenas', () => {
  it('el personal de otra cadena no ve el plan', async () => {
    expect((await read('plans', f.pro2)).totalDocs).toBe(0)
    await expect(payload.findByID({ collection: 'plans', id: f.plan.id, user: f.pro2, overrideAccess: false })).rejects.toThrow()
  })

  it('el personal de la propia cadena sí lo ve', async () => {
    expect((await read('plans', f.pro1)).totalDocs).toBe(1)
  })

  it('la administración de la cadena no ve datos de salud', async () => {
    await expect(read('plans', f.chainAdmin1)).rejects.toThrow()
    await expect(read('plan-items', f.chainAdmin1)).rejects.toThrow()
  })

  it('cada cliente ve solo lo suyo', async () => {
    expect((await read('plans', f.ana)).totalDocs).toBe(1)
    expect((await read('plans', f.bea)).totalDocs).toBe(0)
  })

  it('el personal solo ve clientes vinculados a su cadena', async () => {
    const seen = await read('customers', f.pro2)
    expect(seen.docs.map((c: any) => c.alias)).toEqual(['Bea'])
  })

  it('no se puede crear un plan para un cliente no vinculado', async () => {
    await expect(
      payload.create({ collection: 'plans', data: { title: 'x', customer: f.ana.id }, user: f.pro2, overrideAccess: false } as any),
    ).rejects.toThrow(/no está vinculado/)
  })
})

describe('permisos por función', () => {
  it('quien solo prepara planes no puede confirmarlos', async () => {
    const draft = await payload.create({ collection: 'plans', data: { title: 'Borrador', customer: f.ana.id }, user: f.counter1, overrideAccess: false } as any)
    await expect(
      payload.update({ collection: 'plans', id: draft.id, data: { status: 'active' }, user: f.counter1, overrideAccess: false }),
    ).rejects.toThrow(/profesional autorizado/)
  })

  it('el cliente puede cambiar la hora del recordatorio, pero no la pauta', async () => {
    const ok = await payload.update({ collection: 'plan-items', id: f.item.id, data: { reminderTime: '08:15' }, user: f.ana, overrideAccess: false })
    expect(ok.reminderTime).toBe('08:15')
    await expect(
      payload.update({ collection: 'plan-items', id: f.item.id, data: { servingsPerIntake: 4 }, user: f.ana, overrideAccess: false }),
    ).rejects.toThrow(/No puedes modificar/)
  })

  it('un cliente no puede registrar tomas en el plan de otra persona', async () => {
    await expect(
      payload.create({ collection: 'intake-logs', data: { planItem: f.item.id, date: '2026-10-02', status: 'taken', servings: 2 }, user: f.bea, overrideAccess: false } as any),
    ).rejects.toThrow()
  })
})

describe('trazabilidad', () => {
  it('modificar un plan activo exige motivo y queda registrado', async () => {
    await expect(
      payload.update({ collection: 'plan-items', id: f.item.id, data: { servingsPerIntake: 1 }, user: f.pro1, overrideAccess: false }),
    ).rejects.toThrow(/motivo/)

    await payload.update({ collection: 'plan-items', id: f.item.id, data: { servingsPerIntake: 1, changeReason: 'Molestias digestivas' }, user: f.pro1, overrideAccess: false })

    const log = await payload.find({ collection: 'audit-log', where: { and: [{ targetCollection: { equals: 'plan-items' } }, { operation: { equals: 'update' } }] }, overrideAccess: true })
    const entry = log.docs.find((d: any) => d.reason === 'Molestias digestivas')
    expect(entry).toBeDefined()
    expect(entry!.changedFields).toContain('servingsPerIntake')
    expect(entry!.actorId).toBe(String(f.pro1.id))
  })

  it('una formulación verificada no cambia: un cambio de fórmula exige otra versión', async () => {
    await expect(
      payload.update({
        collection: 'formulations',
        id: f.formulation.id,
        data: { composition: [{ ingredient: f.ingredient.id, amount: 120, unit: 'mg', basis: 'active' }] },
        user: f.editor,
        overrideAccess: false,
      }),
    ).rejects.toThrow(/versión nueva/)
  })
})

describe('flujo editorial', () => {
  it('editorial no puede aprobar una ficha', async () => {
    await expect(
      payload.update({ collection: 'ingredients', id: f.ingredient.id, data: { editorialStatus: 'approved' }, user: f.editor, overrideAccess: false }),
    ).rejects.toThrow(/revisión profesional/)
  })

  it('revisión no puede aprobar una ficha incompleta y dice qué falta', async () => {
    await expect(
      payload.update({ collection: 'ingredients', id: f.ingredient.id, data: { editorialStatus: 'approved' }, user: f.reviewer, overrideAccess: false }),
    ).rejects.toThrow(/Faltan: .*Resumen en una frase/)
  })

  it('el cliente no ve fichas sin aprobar', async () => {
    expect((await read('ingredients', f.ana)).totalDocs).toBe(0)
  })
})
