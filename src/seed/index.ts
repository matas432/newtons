/**
 * Datos de la demo (etapa B del Libro 1 v2.0). Uso: `pnpm seed` (borra y
 * vuelve a crear todo).
 *
 * - Datos de referencia: dominios, ritmos y bloques (es/de/en).
 * - Fichas: `seed-data/private/*.json` si existen (contenido no publicado,
 *   fuera del repositorio) o, si no, `seed-data/example/*.json` (ficticia).
 * - Proveedor, productos, lotes, cliente, pedidos y plan: ficticios.
 *
 * Recorre el circuito completo: compra → pago simulado → empaquetado →
 * envío → «Mis productos» → plan → tomas → revisión.
 */
import fs from 'fs'
import path from 'path'
import { getPayload, type CollectionSlug } from 'payload'

import config from '@payload-config'
import { createOrder } from '@/commerce/checkout'
import { simulatePayment } from '@/commerce/payments'
import { addDays } from '@/lib/schedule'

import { resetDatabase } from './reset'

const DEMO_PASSWORD = 'demo-newtons'
const root = process.cwd()
const today = new Date().toISOString().slice(0, 10)

const lexical = (paragraphs: string[]) => ({
  root: {
    type: 'root',
    format: '' as const,
    indent: 0,
    version: 1,
    direction: 'ltr' as const,
    children: paragraphs.map((text) => ({
      type: 'paragraph',
      format: '' as const,
      indent: 0,
      version: 1,
      direction: 'ltr' as const,
      textFormat: 0,
      textStyle: '',
      children: [{ type: 'text', text, format: 0, style: '', mode: 'normal', detail: 0, version: 1 }],
    })),
  },
})

async function main() {
  const payload = await getPayload({ config })
  payload.logger.info('Borrando datos anteriores…')
  await resetDatabase(payload)

  const create = <T extends CollectionSlug>(collection: T, data: any, user?: any, locale = 'es') =>
    payload.create({ collection, data, overrideAccess: true, user, locale, disableVerificationEmail: true } as any) as Promise<any>
  const translate = <T extends CollectionSlug>(collection: T, id: number, locale: 'de' | 'en', data: any) =>
    payload.update({ collection, id, data, locale, overrideAccess: true, context: { skipGuards: true } } as any)

  // ------------------------------------------------------------ referencia
  payload.logger.info('Dominios, ritmos y bloques…')
  const domains: Record<string, any> = {}
  const DOMAINS: Array<[string, string, string, string, string, string]> = [
    ['DF-1', 'Base nutricional', 'Nährstoffbasis', 'Nutritional foundation', 'Suficiencia biológica', 'Disponibilidad de sustratos, micronutrientes, cofactores y reservas.'],
    ['DF-2', 'Aprendizaje y memoria', 'Lernen und Gedächtnis', 'Learning and memory', 'Plasticidad y adaptación neuronal', 'Aprendizaje, memoria, adaptación y respuesta a experiencias nuevas.'],
    ['DF-3', 'Energía y capacidad física', 'Energie und körperliche Leistungsfähigkeit', 'Energy and physical capacity', 'Bioenergética y capacidad funcional', 'Energía disponible para actuar, capacidad física y margen funcional.'],
    ['DF-4', 'Iniciativa y esfuerzo', 'Antrieb und Anstrengung', 'Initiative and effort', 'Iniciación, esfuerzo y recompensa', 'Inicio de actividades, disposición al esfuerzo y valor de lo que se intenta hacer.'],
    ['DF-5', 'Inflamación y equilibrio celular', 'Entzündung und Zellgleichgewicht', 'Inflammation and cellular balance', 'Regulación inmunoinflamatoria y redox', 'Procesos inmunoinflamatorios, regulación redox y su relación con el funcionamiento corporal.'],
    ['DF-6', 'Digestión e intestino-cerebro', 'Verdauung und Darm-Hirn-Achse', 'Digestion and gut–brain', 'Regulación intestino-cerebro', 'Función digestiva y relación entre el intestino y el sistema nervioso.'],
    ['DF-7', 'Sueño y recuperación', 'Schlaf und Erholung', 'Sleep and recovery', 'Sueño, ritmo circadiano y recuperación', 'Sueño, organización temporal y recuperación.'],
  ]
  for (const [i, [code, es, de, en, technicalName, description]] of DOMAINS.entries()) {
    domains[code] = await create('domains', { code, clientName: es, technicalName, description, order: i + 1 })
    await translate('domains', domains[code].id, 'de', { clientName: de, technicalName })
    await translate('domains', domains[code].id, 'en', { clientName: en, technicalName })
  }

  // Nombres alemanes e ingleses de los ritmos: propuesta pendiente de decisión.
  const rhythms: Record<string, any> = {}
  const RHYTHMS = [
    { code: 'rio', name: 'Río', de: 'Fluss', en: 'River', continuous: true, reviewEveryWeeks: 12, description: 'Uso continuo; revisión cada doce semanas; sin pausa fija obligatoria.' },
    { code: 'terreno', name: 'Terreno', de: 'Boden', en: 'Terrain', useWeeks: 12, pauseWeeks: 4, description: 'Doce semanas de uso y cuatro semanas de pausa/revisión.' },
    { code: 'cultivo', name: 'Cultivo', de: 'Anbau', en: 'Cultivate', useWeeks: 12, pauseWeeks: 4, allowsSelectiveUse: true, description: 'Doce semanas de observación y cuatro semanas de pausa/revisión; admite uso selectivo.' },
    { code: 'cosecha', name: 'Cosecha', de: 'Ernte', en: 'Harvest', useWeeks: 12, pauseWeeks: 12, pauseIsMinimum: true, description: 'Doce semanas de uso y al menos doce semanas de pausa antes de reconsiderar.' },
  ]
  for (const { de, en, ...r } of RHYTHMS) {
    rhythms[r.code] = await create('rhythms', r)
    await translate('rhythms', rhythms[r.code].id, 'de', { name: de })
    await translate('rhythms', rhythms[r.code].id, 'en', { name: en })
  }

  const blocks: Record<string, any> = {}
  const BLOCKS = [
    { code: 'A', name: 'Ayunas', de: 'Nüchtern', en: 'Fasting', defaultTime: '07:30', mealRelation: 'fasting', provisional: false },
    { code: 'B', name: 'Desayuno', de: 'Frühstück', en: 'Breakfast', defaultTime: '08:00', mealRelation: 'with-food', provisional: true },
    { code: 'C', name: 'Comida', de: 'Mittagessen', en: 'Lunch', defaultTime: '13:00', mealRelation: 'with-food', provisional: true },
    { code: 'D', name: 'Noche', de: 'Abend', en: 'Evening', defaultTime: '21:00', mealRelation: 'any', provisional: true },
  ]
  for (const [i, { de, en, ...b }] of BLOCKS.entries()) {
    blocks[b.code] = await create('blocks', { ...b, order: i + 1, description: b.provisional ? 'Provisional: lista de bloques pendiente de definición.' : undefined })
    await translate('blocks', blocks[b.code].id, 'de', { name: de })
    await translate('blocks', blocks[b.code].id, 'en', { name: en })
  }

  // ------------------------------------------------------------ equipo
  payload.logger.info('Equipo Newtons…')
  const staff = async (name: string, email: string, role: string) => ({
    ...(await create('users', { name, email, password: DEMO_PASSWORD, role })),
    collection: 'users',
  })
  await staff('Administración técnica', 'admin@newtons.test', 'admin')
  const editor = await staff('Sebastián (editorial)', 'editor@newtons.test', 'editor')
  const reviewer = await staff('Revisión profesional', 'revision@newtons.test', 'reviewer')
  const ops = await staff('Operaciones', 'operaciones@newtons.test', 'operations')
  await staff('Soporte', 'soporte@newtons.test', 'support')

  // ------------------------------------------------------------ fichas
  payload.logger.info('Fichas…')
  const privateDir = path.join(root, 'seed-data/private')
  const exampleDir = path.join(root, 'seed-data/example')
  const privateFiles = fs.existsSync(privateDir) ? fs.readdirSync(privateDir).filter((f) => f.endsWith('.json')).map((f) => path.join(privateDir, f)) : []
  const exampleFiles = fs.readdirSync(exampleDir).filter((f) => f.endsWith('.json')).map((f) => path.join(exampleDir, f))
  payload.logger.info(privateFiles.length ? `  ${privateFiles.length} ficha(s) privada(s) + ficha ficticia` : '  sin fichas privadas: solo la ficha ficticia')

  const ingredients: any[] = []
  for (const file of [...privateFiles, ...exampleFiles]) {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
    const sourceIds: Record<string, number> = {}
    for (const s of raw.sources ?? []) {
      const { ref, ...data } = s
      sourceIds[ref] = (await create('sources', data)).id
    }
    const doc = await create(
      'ingredients',
      {
        ...raw,
        editorialStatus: 'in-review',
        primaryDomain: raw.primaryDomain ? domains[raw.primaryDomain].id : undefined,
        secondaryDomain: raw.secondaryDomain ? domains[raw.secondaryDomain].id : undefined,
        block: raw.block ? blocks[raw.block].id : undefined,
        rhythm: raw.rhythm ? rhythms[raw.rhythm].id : undefined,
        sources: Object.values(sourceIds),
        claims: (raw.claims ?? []).map(({ sourceRefs, ...c }: any) => ({ ...c, sources: (sourceRefs ?? []).map((r: string) => sourceIds[r]) })),
        moreWhatIs: raw.moreWhatIs ? lexical(raw.moreWhatIs) : undefined,
        moreWhyUseful: raw.moreWhyUseful ? lexical(raw.moreWhyUseful) : undefined,
        moreHowToUse: raw.moreHowToUse ? lexical(raw.moreHowToUse) : undefined,
        moreCautions: raw.moreCautions ? lexical(raw.moreCautions) : undefined,
        translationStatus: 'draft',
      },
      editor,
    )
    // Demo: la revisión incluye la ficha en el pool y la aprueba para poder
    // recorrer el circuito de venta. No es una aprobación real del contenido.
    await payload.update({
      collection: 'ingredients',
      id: doc.id,
      data: {
        poolStatus: 'in-pool',
        editorialStatus: 'approved',
        sources: Object.values(sourceIds).length ? Object.values(sourceIds) : [(await create('sources', { title: 'Fuente ficticia (demo)', kind: 'internal' })).id],
        internalNotes: `${raw.internalNotes ?? ''}\nAprobada solo en la base de datos de demostración.`.trim(),
      },
      user: reviewer,
      overrideAccess: true,
    })
    ingredients.push(doc)
  }
  const outOfPool = await create('ingredients', { name: 'Ingrediente fuera del pool (ficticio)', slug: 'fuera-del-pool', category: 'other', isFictional: true, poolStatus: 'candidate' }, editor)

  // ------------------------------------------------------------ catálogo
  payload.logger.info('Proveedor, productos y lotes…')
  const supplier = await create('suppliers', { name: 'Proveedor suizo de demostración (ficticio)', status: 'candidate', country: 'CH' }, ops)

  await payload.updateGlobal({
    slug: 'shop-settings',
    data: {
      shippingOptions: [
        { code: 'economy', label: 'PostPac Economy', price: 8.9, maxWeightGrams: 2000, deliveryNote: '2 días laborables tras el depósito' },
        { code: 'priority', label: 'PostPac Priority', price: 10.9, maxWeightGrams: 2000, deliveryNote: 'Siguiente día laborable tras el depósito' },
      ],
      minShelfLifeDays: 90,
      preparationNote: 'Preparamos los pedidos en días laborables.',
    },
    overrideAccess: true,
  })

  const makeProduct = async (p: { name: string; slug: string; kind?: string; price?: number; servingUnit: string; units: number; ingredient: any; amount: number; basis: string; daily: [number, number]; directions: string }) => {
    const product = await create('products', {
      name: p.name,
      slug: p.slug,
      brand: 'Marca Demo',
      manufacturer: 'Fabricante Demo AG (ficticio)',
      form: 'capsule',
      servingUnit: p.servingUnit,
      unitsPerContainer: p.units,
      kind: p.kind ?? 'catalog',
      sku: p.kind === 'external' ? undefined : p.slug.toUpperCase(),
      price: p.price,
      supplier: p.kind === 'external' ? undefined : supplier.id,
      weightGrams: 120,
      origin: { countryOfManufacture: 'CH', packagingPlace: 'CH', responsibleCompany: 'Fabricante Demo AG (ficticio)' },
      storage: { conditions: 'Lugar seco, por debajo de 25 °C', coldChainRequired: false },
      isFictional: true,
    })
    await create(
      'formulations',
      {
        product: product.id,
        validFrom: '2026-01-01',
        composition: [{ ingredient: p.ingredient.id, amount: p.amount, unit: 'mg', basis: p.basis, extractDetails: 'Datos ficticios de demostración' }],
        labelInfo: { directions: p.directions, dailyUnitsMin: p.daily[0], dailyUnitsMax: p.daily[1] },
        verificationStatus: 'verified',
        source: 'Etiqueta ficticia (demo)',
        sourceDate: '2026-10-01',
      },
      reviewer,
    )
    if (p.kind !== 'external') await payload.update({ collection: 'products', id: product.id, data: { saleStatus: 'for-sale' }, overrideAccess: true })
    return payload.findByID({ collection: 'products', id: product.id, overrideAccess: true })
  }

  const [main, example] = ingredients.length > 1 ? ingredients : [ingredients[0], ingredients[0]]
  const productA = await makeProduct({ name: `${main.name} Demo 250 (ficticio)`, slug: 'demo-a', price: 34.9, servingUnit: 'cápsula', units: 60, ingredient: main, amount: 250, basis: 'extract', daily: [1, 2], directions: '1–2 cápsulas al día con agua (texto ficticio de etiqueta).' })
  const productB = await makeProduct({ name: `${example.name} Demo (ficticio)`, slug: 'demo-b', price: 24.9, servingUnit: 'cápsula', units: 30, ingredient: example, amount: 100, basis: 'active', daily: [1, 1], directions: '1 cápsula al día (texto ficticio de etiqueta).' })
  const externalVerified = await makeProduct({ name: `Otra marca ${main.name} 200 (externo, ficticio)`, slug: 'externo-verificado', kind: 'external', servingUnit: 'cápsula', units: 90, ingredient: main, amount: 200, basis: 'extract', daily: [1, 2], directions: '1–2 cápsulas al día (texto ficticio).' })

  for (const t of [
    { product: productA, lotNumber: 'DEMO-A-01', expiryDate: addDays(today, 700), quantityReceived: 12 },
    { product: productA, lotNumber: 'DEMO-A-02', expiryDate: addDays(today, 45), quantityReceived: 4, statusNote: 'Caduca pronto: por debajo de la vida útil mínima, no se vende.' },
    { product: productA, lotNumber: 'DEMO-A-03', expiryDate: addDays(today, 800), quantityReceived: 6, status: 'held', statusNote: 'Retenido: envase dañado en la recepción.' },
    { product: productB, lotNumber: 'DEMO-B-01', expiryDate: addDays(today, 500), quantityReceived: 10 },
  ]) {
    await create('lots', { ...t, product: t.product.id, receivedOn: addDays(today, -20), storageLocation: 'Estante 1' }, ops)
  }

  // ------------------------------------------------------------ cliente
  payload.logger.info('Cliente, pedidos y plan ficticios…')
  const customerDoc = await create('customers', { alias: 'Anna (demo)', email: 'anna@demo.test', password: DEMO_PASSWORD, language: 'de', adultConfirmed: true, isFictional: true, _verified: true })
  const customer = { ...customerDoc, collection: 'customers' }
  for (const kind of ['terms', 'privacy', 'tracking-data']) await create('consents', { customer: customer.id, kind, version: 'demo-0.1' }, customer)

  const address = { name: 'Anna Muster', street: 'Musterstrasse 1', postalCode: '8000', city: 'Zürich' }

  // Pedido 1: comprado, pagado, empaquetado y enviado hace dos semanas.
  const order1 = await createOrder(payload, { customerId: customer.id, items: [{ productId: productA.id, quantity: 1 }], shippingCode: 'economy', address })
  await simulatePayment(payload, order1.id)
  await simulatePayment(payload, order1.id) // reintento del proveedor: sin efecto
  await payload.update({ collection: 'orders', id: order1.id, data: { status: 'packed' }, user: ops, overrideAccess: true })
  await payload.update({ collection: 'orders', id: order1.id, data: { status: 'shipped', shipment: { trackingNumber: '99.00.000000.00000000', depositedOn: addDays(today, -16), weightGrams: 310 } }, user: ops, overrideAccess: true })

  // Pedido 2: pendiente de pago.
  await createOrder(payload, { customerId: customer.id, items: [{ productId: productB.id, quantity: 1 }], shippingCode: 'economy', address })

  // «Mis productos»: el envío sugirió el producto; Anna lo confirma.
  const suggested = await payload.find({ collection: 'customer-products', where: { customer: { equals: customer.id } }, overrideAccess: true })
  const myProduct = await payload.update({ collection: 'customer-products', id: suggested.docs[0].id, data: { status: 'active' }, user: customer, overrideAccess: false })

  // Plan declarado por Anna: 2 cápsulas en ayunas, empezó hace 14 días.
  const startDate = addDays(today, -14)
  const item = await create('plan-items', { customerProduct: myProduct.id, intakes: [{ block: blocks.A.id, time: '07:30', servings: 2 }], startDate, scheduleType: 'daily' }, customer)

  // Últimos días: tomas, una omisión y días sin registro (no equivalen a «tomado»).
  for (let d = 1; d <= 7; d++) {
    if (d === 3 || d === 6) continue
    await create('intake-logs', { planItem: item.id, date: addDays(today, -d), intakeIndex: 0, status: d === 4 ? 'skipped' : 'taken', servings: d === 4 ? 0 : 2 }, customer)
  }

  // Productos comprados en otro lugar: uno pendiente y verificado después; otro fuera del pool.
  const sub = await create('product-submissions', { productName: externalVerified.name, manufacturer: 'Otra marca AG', declaredIngredients: [{ ingredient: main.id, amountText: '200 mg' }] }, customer)
  await payload.update({ collection: 'product-submissions', id: sub.id, data: { status: 'verified', resultProduct: externalVerified.id, reviewNote: 'Verificado con la etiqueta (demo).' }, user: reviewer, overrideAccess: true })
  await create('product-submissions', { productName: 'Mezcla con un ingrediente no cubierto (ficticio)', manufacturer: 'Otra marca AG', declaredIngredients: [{ ingredient: main.id }], otherIngredients: outOfPool.name }, customer)

  payload.logger.info('Listo. Contraseña de todas las cuentas demo: ' + DEMO_PASSWORD)
  process.exit(0)
}

// `payload run` termina el proceso al acabar de importar el módulo: hay que esperar.
try {
  await main()
} catch (err) {
  console.error(err)
  process.exit(1)
}
