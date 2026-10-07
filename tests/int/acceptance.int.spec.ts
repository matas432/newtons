import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createOrder } from '@/commerce/checkout'
import { recordPaymentEvent, simulatePayment } from '@/commerce/payments'
import { addDays } from '@/lib/schedule'
import config from '@/payload.config'
import { resetDatabase } from '@/seed/reset'

/**
 * Pruebas de aceptación de la primera versión (Libro 1 v2.0, cap. 15):
 * compra y operación, contenido y cobertura, plan y calendario, privacidad.
 */

let payload: Payload
const today = new Date().toISOString().slice(0, 10)
const f: Record<string, any> = {}
const as = (collection: 'users' | 'customers', doc: any) => ({ ...doc, collection })
const create = (collection: any, data: any, user?: any) =>
  payload.create({ collection, data, user, overrideAccess: true, disableVerificationEmail: true } as any) as Promise<any>
const asUser = (user: any) => ({ user, overrideAccess: false as const })
const address = { name: 'Test', street: 'Teststrasse 1', postalCode: '8000', city: 'Zürich' }

async function ship(orderId: number) {
  await payload.update({ collection: 'orders', id: orderId, data: { status: 'packed' }, ...asUser(f.ops) })
  await payload.update({ collection: 'orders', id: orderId, data: { status: 'shipped', shipment: { trackingNumber: `T-${orderId}`, depositedOn: today } }, ...asUser(f.ops) })
}

async function paidOrder(customer: any, quantity = 1) {
  const order = await createOrder(payload, { customerId: customer.id, items: [{ productId: f.product.id, quantity }], shippingCode: 'economy', address })
  await simulatePayment(payload, order.id)
  return order
}

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  await resetDatabase(payload)

  const staff = async (role: string) => as('users', await create('users', { name: role, email: `${role}@t.test`, password: 'test-password', role }))
  f.editor = await staff('editor')
  f.reviewer = await staff('reviewer')
  f.ops = await staff('operations')
  f.support = await staff('support')

  const domain = await create('domains', { code: 'DF-4', clientName: 'Iniciativa', technicalName: 'Iniciación', order: 1 })
  const rhythm = await create('rhythms', { code: 'cultivo', name: 'Cultivo', useWeeks: 12, pauseWeeks: 4 })
  f.block = await create('blocks', { code: 'A', name: 'Ayunas', defaultTime: '07:30', order: 1 })
  const source = await create('sources', { title: 'Fuente', kind: 'internal' })

  const ficha = {
    category: 'other',
    summary: 'Resumen',
    whatIsShort: 'Qué es',
    primaryDomain: domain.id,
    mechanisms: 'Mecanismos',
    goalEveryday: 'Objetivo',
    reviewQuestion: '¿Cambió algo?',
    block: f.block.id,
    rhythm: rhythm.id,
    tolerability: 'Buena',
    alertSummary: { status: 'no' },
    interactionSummary: { status: 'no' },
    evidenceSummary: 'Limitada',
    observations: [{ text: 'Uno' }, { text: 'Dos' }],
    sources: [source.id],
  }
  f.inPool = await create('ingredients', { ...ficha, name: 'En el pool', slug: 'en-pool' }, f.editor)
  await payload.update({ collection: 'ingredients', id: f.inPool.id, data: { poolStatus: 'in-pool', editorialStatus: 'approved' }, ...asUser(f.reviewer) })
  f.outPool = await create('ingredients', { name: 'Fuera del pool', slug: 'fuera-pool', category: 'other' }, f.editor)

  await payload.updateGlobal({ slug: 'shop-settings', data: { shippingOptions: [{ code: 'economy', label: 'Economy', price: 8.9 }], minShelfLifeDays: 90 }, overrideAccess: true })
  const supplier = await create('suppliers', { name: 'Proveedor', status: 'confirmed' })

  f.product = await create('products', {
    name: 'Producto',
    slug: 'producto',
    form: 'capsule',
    servingUnit: 'cápsula',
    price: 30,
    vatRate: 2.6,
    supplier: supplier.id,
    origin: { countryOfManufacture: 'CH' },
  })
  f.formulation = await create(
    'formulations',
    { product: f.product.id, composition: [{ ingredient: f.inPool.id, amount: 100, unit: 'mg', basis: 'active' }], verificationStatus: 'verified', source: 'Etiqueta' },
    f.reviewer,
  )
  await payload.update({ collection: 'products', id: f.product.id, data: { saleStatus: 'for-sale' }, overrideAccess: true })

  // Lotes: uno bueno, uno retenido con vencimiento más próximo y uno que caduca pronto.
  f.goodLot = await create('lots', { product: f.product.id, lotNumber: 'OK', expiryDate: addDays(today, 600), quantityReceived: 5 }, f.ops)
  f.heldLot = await create('lots', { product: f.product.id, lotNumber: 'HELD', expiryDate: addDays(today, 300), quantityReceived: 5, status: 'held' }, f.ops)
  f.shortLot = await create('lots', { product: f.product.id, lotNumber: 'SHORT', expiryDate: addDays(today, 30), quantityReceived: 5 }, f.ops)

  f.ana = as('customers', await create('customers', { alias: 'Ana', email: 'ana@t.test', password: 'test-password', adultConfirmed: true, _verified: true }))
  f.bea = as('customers', await create('customers', { alias: 'Bea', email: 'bea@t.test', password: 'test-password', adultConfirmed: true, _verified: true }))

  // Ana compra, se le envía, confirma el producto y crea su plan.
  f.order = await paidOrder(f.ana)
  await ship(f.order.id)
  const cp = (await payload.find({ collection: 'customer-products', where: { customer: { equals: f.ana.id } }, overrideAccess: true })).docs[0]
  f.myProduct = await payload.update({ collection: 'customer-products', id: cp.id, data: { status: 'active' }, ...asUser(f.ana) })
  f.item = await payload.create({
    collection: 'plan-items',
    data: { customerProduct: f.myProduct.id, intakes: [{ block: f.block.id, servings: 1 }], startDate: today, scheduleType: 'daily' } as any,
    ...asUser(f.ana),
  })
  f.log = await payload.create({ collection: 'intake-logs', data: { planItem: f.item.id, date: today, status: 'taken', servings: 1 } as any, ...asUser(f.ana) })
}, 120_000)

afterAll(async () => {
  await resetDatabase(payload)
})

const count = async (collection: any, where: any = {}) => (await payload.count({ collection, where, overrideAccess: true })).totalDocs

describe('compra y operación', () => {
  it('un pedido no se duplica si la confirmación de pago llega dos veces', async () => {
    const order = await createOrder(payload, { customerId: f.bea.id, items: [{ productId: f.product.id, quantity: 1 }], shippingCode: 'economy', address })
    const ev = { provider: 'stripe' as const, eventId: 'evt_twice', type: 'payment.succeeded' as const, orderId: order.id, amountCents: order.totals!.totalCents! }
    expect(await recordPaymentEvent(payload, ev)).toBe('paid')
    expect(await recordPaymentEvent(payload, ev)).toBe('duplicate')
    expect(await count('payment-events', { eventId: { equals: 'evt_twice' } })).toBe(1)
    expect(await count('orders', { customer: { equals: f.bea.id } })).toBe(1)
  })

  it('un pago por un importe distinto no marca el pedido como pagado', async () => {
    const order = await createOrder(payload, { customerId: f.bea.id, items: [{ productId: f.product.id, quantity: 1 }], shippingCode: 'economy', address })
    expect(await recordPaymentEvent(payload, { provider: 'stripe', eventId: 'evt_wrong', type: 'payment.succeeded', orderId: order.id, amountCents: 1 })).toBe('amount-mismatch')
    expect((await payload.findByID({ collection: 'orders', id: order.id, overrideAccess: true })).status).toBe('pending-payment')
  })

  it('los precios los fija el servidor, no el navegador', async () => {
    const order = await createOrder(payload, { customerId: f.bea.id, items: [{ productId: f.product.id, quantity: 1, unitPriceCents: 1 } as any], shippingCode: 'economy', address })
    expect(order.lines![0].unitPriceCents).toBe(3000)
    expect(order.totals?.totalCents).toBe(3890)
  })

  it('un lote retenido o con poca vida útil no se vende', async () => {
    const lots = (await payload.findByID({ collection: 'orders', id: f.order.id, overrideAccess: true })).lines![0].lots!
    expect(lots.map((l: any) => (typeof l.lot === 'object' ? l.lot.id : l.lot))).toEqual([f.goodLot.id])
    // Quedan 4 vendibles en el lote bueno, menos lo reservado por pedidos pagados sin empaquetar.
    await expect(createOrder(payload, { customerId: f.bea.id, items: [{ productId: f.product.id, quantity: 9 }], shippingCode: 'economy', address })).rejects.toThrow(/quedan/)
  })

  it('no se marca como enviado sin número de seguimiento y fecha de depósito', async () => {
    const order = await paidOrder(f.bea)
    await payload.update({ collection: 'orders', id: order.id, data: { status: 'packed' }, ...asUser(f.ops) })
    await expect(payload.update({ collection: 'orders', id: order.id, data: { status: 'shipped' }, ...asUser(f.ops) })).rejects.toThrow(/seguimiento/)
  })

  it('una compra no se reescribe desde el panel', async () => {
    const updated = await payload.update({ collection: 'orders', id: f.order.id, data: { lines: [], totals: { totalCents: 1 } } as any, ...asUser(f.ops) })
    expect(updated.lines).toHaveLength(1)
    expect(updated.totals?.totalCents).toBe(3890)
  })

  it('devolver no borra una toma registrada y las unidades vuelven retenidas', async () => {
    await payload.update({
      collection: 'orders',
      id: f.order.id,
      data: { returns: [{ product: f.product.id, lot: f.goodLot.id, quantity: 1, reason: 'Prueba' }] } as any,
      ...asUser(f.ops),
    })
    expect(await count('intake-logs', { id: { equals: f.log.id } })).toBe(1)
    const ret = await payload.find({ collection: 'stock-movements', where: { kind: { equals: 'return' } }, overrideAccess: true })
    expect(ret.docs[0]).toMatchObject({ bucket: 'held', quantity: 1 })
    expect((await payload.findByID({ collection: 'orders', id: f.order.id, overrideAccess: true })).status).toBe('returned')
  })
})

describe('contenido y cobertura', () => {
  it('no se verifica una composición con un ingrediente fuera del pool', async () => {
    const p = await create('products', { name: 'Mezcla', form: 'capsule', servingUnit: 'cápsula', kind: 'external' })
    await expect(
      create('formulations', { product: p.id, composition: [{ ingredient: f.outPool.id, amount: 5, unit: 'mg', basis: 'active' }], verificationStatus: 'verified', source: 'Etiqueta' }, f.reviewer),
    ).rejects.toThrow(/no está en el pool/)
  })

  it('un producto externo con un ingrediente no cubierto queda como solicitud, no entra en el plan', async () => {
    const sub = await payload.create({
      collection: 'product-submissions',
      data: { productName: 'X', manufacturer: 'Y', declaredIngredients: [{ ingredient: f.inPool.id }], otherIngredients: 'Molécula Z', status: 'verified' } as any,
      ...asUser(f.bea),
    })
    expect(sub.status).toBe('out-of-pool')
  })

  it('una composición pendiente no se puede añadir a «Mis productos»', async () => {
    const p = await create('products', { name: 'Pendiente', form: 'capsule', servingUnit: 'cápsula', kind: 'external' })
    const pending = await create('formulations', { product: p.id, composition: [{ ingredient: f.inPool.id, amount: 5, unit: 'mg', basis: 'active' }] }, f.editor)
    await expect(
      payload.create({ collection: 'customer-products', data: { product: p.id, formulation: pending.id } as any, ...asUser(f.bea) }),
    ).rejects.toThrow(/pendiente de verificación/)
  })

  it('una versión nueva de la fórmula no reescribe el historial', async () => {
    await expect(
      payload.update({ collection: 'formulations', id: f.formulation.id, data: { composition: [{ ingredient: f.inPool.id, amount: 120, unit: 'mg', basis: 'active' }] }, ...asUser(f.editor) }),
    ).rejects.toThrow(/versión nueva/)
    const v2 = await create('formulations', { product: f.product.id, composition: [{ ingredient: f.inPool.id, amount: 120, unit: 'mg', basis: 'active' }], verificationStatus: 'verified', source: 'Etiqueta v2' }, f.reviewer)
    const product = await payload.findByID({ collection: 'products', id: f.product.id, depth: 0, overrideAccess: true })
    expect(product.currentFormulation).toBe(v2.id)
    expect((await payload.findByID({ collection: 'customer-products', id: f.myProduct.id, depth: 0, overrideAccess: true })).formulation).toBe(f.formulation.id)
    expect((await payload.findByID({ collection: 'orders', id: f.order.id, depth: 0, overrideAccess: true })).lines![0].formulation).toBe(f.formulation.id)
  })

  it('no se pone a la venta un producto sin proveedor, origen ni ficha aprobada', async () => {
    const p = await create('products', { name: 'Incompleto', form: 'capsule', servingUnit: 'cápsula', price: 10 })
    await expect(payload.update({ collection: 'products', id: p.id, data: { saleStatus: 'for-sale' }, ...asUser(f.ops) })).rejects.toThrow(/proveedor.*país de fabricación.*formulación verificada/)
  })
})

describe('plan y calendario', () => {
  it('la compra y el envío no inician un ciclo ni registran tomas', async () => {
    const order = await paidOrder(f.bea)
    await ship(order.id)
    expect(await count('plan-items', { customer: { equals: f.bea.id } })).toBe(0)
    expect(await count('intake-logs', { customer: { equals: f.bea.id } })).toBe(0)
    const cps = await payload.find({ collection: 'customer-products', where: { customer: { equals: f.bea.id } }, overrideAccess: true })
    expect(cps.docs.map((d: any) => d.status)).toEqual(['suggested'])
  })

  it('no se puede planificar un producto sugerido sin confirmarlo', async () => {
    const cp = (await payload.find({ collection: 'customer-products', where: { customer: { equals: f.bea.id } }, overrideAccess: true })).docs[0]
    await expect(
      payload.create({ collection: 'plan-items', data: { customerProduct: cp.id, intakes: [{ block: f.block.id, servings: 1 }], startDate: today, scheduleType: 'daily' } as any, ...asUser(f.bea) }),
    ).rejects.toThrow(/Confirma primero/)
  })

  it('el plan nace sin revisión profesional y el cliente no puede atribuírsela', async () => {
    const plan = (await payload.find({ collection: 'plans', where: { customer: { equals: f.ana.id } }, overrideAccess: true })).docs[0]
    expect(plan.professionalReview.status).toBe('not-reviewed')
    const after = await payload.update({ collection: 'plans', id: plan.id, data: { professionalReview: { status: 'reviewed' } }, ...asUser(f.ana) })
    expect(after.professionalReview.status).toBe('not-reviewed')
  })

  it('se crean las revisiones del ciclo y cerrar una no genera una compra', async () => {
    const reviews = await payload.find({ collection: 'reviews', where: { planItem: { equals: f.item.id } }, ...asUser(f.ana) })
    expect(reviews.docs.map((r: any) => r.kind)).toEqual(['end-of-use', 'end-of-pause'])
    const ordersBefore = await count('orders')
    const closed = await payload.update({ collection: 'reviews', id: reviews.docs[0].id, data: { answer: { questionAnswer: 'Sí' }, outcome: 'continue' } as any, ...asUser(f.ana) })
    expect(closed.status).toBe('closed')
    expect(await count('orders')).toBe(ordersBefore)
  })
})

describe('privacidad y permisos', () => {
  const healthCollections = ['plans', 'plan-items', 'intake-logs', 'reviews', 'customer-products', 'symptom-reports']

  it.each(['ops', 'editor', 'reviewer', 'support'])('%s no ve el seguimiento de los clientes', async (who) => {
    for (const collection of healthCollections) {
      await expect(payload.find({ collection: collection as any, ...asUser(f[who]) })).rejects.toThrow()
    }
  })

  it('cada cliente ve solo lo suyo', async () => {
    expect((await payload.find({ collection: 'plan-items', ...asUser(f.bea) })).totalDocs).toBe(0)
    const orders = await payload.find({ collection: 'orders', depth: 0, ...asUser(f.ana) })
    expect(orders.docs.every((o: any) => o.customer === f.ana.id)).toBe(true)
    await expect(payload.findByID({ collection: 'orders', id: f.order.id, ...asUser(f.bea) })).rejects.toThrow()
  })

  it('un cliente no puede registrar tomas en el plan de otra persona', async () => {
    await expect(
      payload.create({ collection: 'intake-logs', data: { planItem: f.item.id, date: today, status: 'taken', servings: 1 } as any, ...asUser(f.bea) }),
    ).rejects.toThrow()
  })

  it('editorial verifica productos enviados sin ver quién los envió', async () => {
    const subs = await payload.find({ collection: 'product-submissions', depth: 0, ...asUser(f.editor) })
    expect(subs.totalDocs).toBeGreaterThan(0)
    expect(subs.docs.every((s: any) => s.customer === undefined)).toBe(true)
  })

  it('operaciones ve los pedidos pero no el plan', async () => {
    expect((await payload.find({ collection: 'orders', ...asUser(f.ops) })).totalDocs).toBeGreaterThan(0)
  })

  it('el registro exige ser mayor de edad', async () => {
    await expect(payload.create({ collection: 'customers', data: { alias: 'X', email: 'x@t.test', password: 'test-password', adultConfirmed: false } as any, disableVerificationEmail: true })).rejects.toThrow(/adultas/)
  })
})
