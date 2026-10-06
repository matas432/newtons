/**
 * Datos de la demo. Uso: `pnpm seed` (borra y vuelve a crear todo).
 *
 * - Datos de referencia reales: dominios (Libro 2, n.º 19), ritmos y bloques.
 * - Fichas: se cargan desde `seed-data/private/*.json` si existen (contenido
 *   MAT no publicado, fuera del repositorio) o, si no, desde
 *   `seed-data/example/*.json` (ficha ficticia).
 * - Droguería, personal, cliente, productos y plan: enteramente ficticios.
 */
import fs from 'fs'
import path from 'path'
import { getPayload, type CollectionSlug } from 'payload'

import config from '@payload-config'
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

  const create = <T extends CollectionSlug>(collection: T, data: any, user?: any) =>
    payload.create({ collection, data, overrideAccess: true, user, locale: 'es' } as any) as Promise<any>

  // ------------------------------------------------------------ referencia
  payload.logger.info('Dominios, ritmos y bloques…')
  const domains: Record<string, any> = {}
  const DOMAINS = [
    ['DF-1', 'Base nutricional', 'Suficiencia biológica', 'Disponibilidad de sustratos, micronutrientes, cofactores y reservas.'],
    ['DF-2', 'Aprendizaje y memoria', 'Plasticidad y adaptación neuronal', 'Aprendizaje, memoria, adaptación y respuesta a experiencias nuevas.'],
    ['DF-3', 'Energía y capacidad física', 'Bioenergética y capacidad funcional', 'Energía disponible para actuar, capacidad física y margen funcional.'],
    ['DF-4', 'Iniciativa y esfuerzo', 'Iniciación, esfuerzo y recompensa', 'Inicio de actividades, disposición al esfuerzo y valor de lo que se intenta hacer.'],
    ['DF-5', 'Inflamación y equilibrio celular', 'Regulación inmunoinflamatoria y redox', 'Procesos inmunoinflamatorios, regulación redox y su relación con el funcionamiento corporal.'],
    ['DF-6', 'Digestión e intestino-cerebro', 'Regulación intestino-cerebro', 'Función digestiva y relación entre el intestino y el sistema nervioso.'],
    ['DF-7', 'Sueño y recuperación', 'Sueño, ritmo circadiano y recuperación', 'Sueño, organización temporal y recuperación.'],
  ]
  for (const [i, [code, clientName, technicalName, description]] of DOMAINS.entries()) {
    domains[code] = await create('domains', { code, clientName, technicalName, description, order: i + 1 })
  }

  const rhythms: Record<string, any> = {}
  const RHYTHMS = [
    { code: 'rio', name: 'Río', continuous: true, reviewEveryWeeks: 12, description: 'Uso continuo; revisión cada doce semanas; sin pausa fija obligatoria.' },
    { code: 'terreno', name: 'Terreno', useWeeks: 12, pauseWeeks: 4, description: 'Doce semanas de uso y cuatro semanas de pausa/revisión.' },
    { code: 'cultivo', name: 'Cultivo', useWeeks: 12, pauseWeeks: 4, allowsSelectiveUse: true, description: 'Doce semanas de observación y cuatro semanas de pausa/revisión; admite uso selectivo.' },
    { code: 'cosecha', name: 'Cosecha', useWeeks: 12, pauseWeeks: 12, pauseIsMinimum: true, description: 'Doce semanas de uso y al menos doce semanas de pausa antes de reconsiderar.' },
  ]
  for (const r of RHYTHMS) rhythms[r.code] = await create('rhythms', r)

  const blocks: Record<string, any> = {}
  const BLOCKS = [
    { code: 'A', name: 'Ayunas', defaultTime: '07:30', mealRelation: 'fasting', provisional: false },
    { code: 'B', name: 'Desayuno', defaultTime: '08:00', mealRelation: 'with-food', provisional: true },
    { code: 'C', name: 'Comida', defaultTime: '13:00', mealRelation: 'with-food', provisional: true },
    { code: 'D', name: 'Noche', defaultTime: '21:00', mealRelation: 'any', provisional: true },
  ]
  for (const [i, b] of BLOCKS.entries()) {
    blocks[b.code] = await create('blocks', { ...b, order: i + 1, description: b.provisional ? 'Provisional: lista de bloques pendiente de definición.' : undefined })
  }

  // ------------------------------------------------------------ equipo Newtons
  payload.logger.info('Equipo Newtons…')
  const staffUser = (doc: any) => ({ ...doc, collection: 'users' })
  const admin = staffUser(await create('users', { name: 'Administración Newtons', email: 'admin@newtons.test', password: DEMO_PASSWORD, role: 'newtons-admin' }))
  const editor = staffUser(await create('users', { name: 'Sebastián (editorial)', email: 'editor@newtons.test', password: DEMO_PASSWORD, role: 'editor' }))
  const reviewer = staffUser(await create('users', { name: 'Revisión profesional', email: 'revision@newtons.test', password: DEMO_PASSWORD, role: 'reviewer' }))

  // ------------------------------------------------------------ fichas
  payload.logger.info('Fichas…')
  const privateDir = path.join(root, 'seed-data/private')
  const exampleDir = path.join(root, 'seed-data/example')
  const files = fs.existsSync(privateDir) ? fs.readdirSync(privateDir).filter((f) => f.endsWith('.json')).map((f) => path.join(privateDir, f)) : []
  const ingredientFiles = files.length ? files : fs.readdirSync(exampleDir).map((f) => path.join(exampleDir, f))
  payload.logger.info(files.length ? `  ${files.length} ficha(s) privada(s)` : '  sin fichas privadas: se usa la ficha ficticia')

  const ingredients: any[] = []
  for (const file of ingredientFiles) {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
    const sourceIds: Record<string, number> = {}
    for (const s of raw.sources ?? []) {
      const { ref, ...data } = s
      sourceIds[ref] = (await create('sources', data)).id
    }
    const data = {
      ...raw,
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
    }
    ingredients.push(await create('ingredients', data, editor))
  }
  const main = ingredients[0]

  // ------------------------------------------------------------ productos
  payload.logger.info('Productos ficticios…')
  const productA = await create('products', { name: `${main.name} Demo 250 (ficticio)`, brand: 'Marca Demo', form: 'capsule', servingUnit: 'cápsula', unitsPerContainer: 60, isFictional: true })
  await create(
    'formulations',
    {
      product: productA.id,
      validFrom: '2026-01-01',
      composition: [{ ingredient: main.id, amount: 250, unit: 'mg', basis: 'extract', extractDetails: 'Datos ficticios de demostración' }],
      verificationStatus: 'verified',
      source: 'Etiqueta ficticia (demo)',
      sourceDate: '2026-10-01',
    },
    reviewer,
  )
  const productB = await create('products', { name: 'Complejo Energía Demo (ficticio)', brand: 'Marca Demo', form: 'tablet', servingUnit: 'comprimido', unitsPerContainer: 30, isFictional: true })
  await create(
    'formulations',
    {
      product: productB.id,
      composition: [
        { ingredient: main.id, amount: 200, unit: 'mg', basis: 'extract' },
        { ingredient: main.id, amount: 300, unit: 'mg', basis: 'blend', extractDetails: 'Mezcla sin desglose (ejemplo de lo que no se suma)' },
      ],
      verificationStatus: 'verified',
      source: 'Etiqueta ficticia (demo)',
    },
    reviewer,
  )
  const productExternal = await create('products', { name: 'Producto externo sin verificar (ficticio)', form: 'capsule', servingUnit: 'cápsula', isFictional: true })
  await create('formulations', { product: productExternal.id, composition: [{ ingredient: main.id, amount: 300, unit: 'mg', basis: 'extract' }], verificationStatus: 'pending', source: 'Foto de etiqueta aportada por el cliente' }, editor)

  // ------------------------------------------------------------ droguería
  payload.logger.info('Droguería ficticia…')
  const chain = await create('chains', {
    name: 'Drogerie Sonnenberg (demo)',
    slug: 'sonnenberg',
    isFictional: true,
    branding: { displayName: 'Drogerie Sonnenberg', primaryColor: '#2F6B4F', accentColor: '#EAF3EE', welcomeMessage: 'Tu plan de suplementos, acompañado por tu droguería.' },
    contact: { email: 'kontakt@sonnenberg.test', phone: '+41 00 000 00 00' },
  })
  const store = await create('stores', { chain: chain.id, name: 'Sonnenberg Zürich (demo)', street: 'Musterstrasse 1', postalCode: '8000', city: 'Zürich' })
  for (const p of [productA, productB]) await create('assortment', { chain: chain.id, product: p.id, active: true })

  await create('users', { name: 'Administración Sonnenberg', email: 'cadena@sonnenberg.test', password: DEMO_PASSWORD, role: 'chain-admin', chain: chain.id })
  await create('users', { name: 'Mostrador', email: 'mostrador@sonnenberg.test', password: DEMO_PASSWORD, role: 'staff', chain: chain.id, stores: [store.id], permissions: ['invite', 'prepare-plans'] })
  const professional = staffUser(
    await create('users', {
      name: 'Profesional autorizada',
      email: 'profesional@sonnenberg.test',
      password: DEMO_PASSWORD,
      role: 'staff',
      chain: chain.id,
      stores: [store.id],
      permissions: ['prepare-plans', 'confirm-plans', 'view-shared-data'],
      professionalTitle: 'Drogista HF (ficticio)',
    }),
  )

  // ------------------------------------------------------------ cliente y plan
  payload.logger.info('Cliente y plan ficticios…')
  const customer = { ...(await create('customers', { alias: 'Ana (demo)', email: 'ana@demo.test', password: DEMO_PASSWORD, language: 'es', adultConfirmed: true, isFictional: true })), collection: 'customers' }
  await create('customer-links', { customer: customer.id, chain: chain.id, store: store.id, status: 'active', identityVerified: true })
  for (const kind of ['terms', 'privacy', 'share-with-chain']) {
    await create('consents', { customer: customer.id, kind, version: 'demo-0.1', chain: kind === 'share-with-chain' ? chain.id : undefined }, customer)
  }

  const plan = await create('plans', { title: 'Mi plan', customer: customer.id, store: store.id, goal: 'Sostener mejor las mañanas exigentes (ejemplo).', status: 'active' }, professional)
  const startDate = addDays(today, -14)
  const item = await create(
    'plan-items',
    { plan: plan.id, product: productA.id, servingsPerIntake: 2, rhythm: rhythms.cultivo.id, startDate, scheduleType: 'daily', reminderTime: '07:30', instructions: 'Por la mañana, en ayunas.' },
    professional,
  )

  // Últimos días: tomas, una omisión y días sin registro (no equivalen a «tomado»).
  for (let d = 1; d <= 7; d++) {
    const date = addDays(today, -d)
    if (d === 3 || d === 6) continue
    await create('intake-logs', { planItem: item.id, date, block: blocks.A.id, status: d === 4 ? 'skipped' : 'taken', servings: d === 4 ? 0 : 2 }, customer)
  }

  await create('reviews', { planItem: item.id, dueDate: addDays(startDate, 12 * 7), kind: 'end-of-use', reviewQuestion: item.reviewQuestion }, professional)

  payload.logger.info('Listo. Contraseña de todas las cuentas demo: ' + DEMO_PASSWORD)
  void admin
  process.exit(0)
}

// `payload run` termina el proceso al acabar de importar el módulo: hay que esperar.
try {
  await main()
} catch (err) {
  console.error(err)
  process.exit(1)
}
