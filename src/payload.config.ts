import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { de } from '@payloadcms/translations/languages/de'
import { en } from '@payloadcms/translations/languages/en'
import { es } from '@payloadcms/translations/languages/es'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { CustomerProducts } from './collections/care/CustomerProducts'
import { IntakeLogs } from './collections/care/IntakeLogs'
import { PlanItems } from './collections/care/PlanItems'
import { Plans } from './collections/care/Plans'
import { ProductSubmissions } from './collections/care/ProductSubmissions'
import { Reviews } from './collections/care/Reviews'
import { SymptomReports } from './collections/care/SymptomReports'
import { Formulations } from './collections/catalog/Formulations'
import { Products } from './collections/catalog/Products'
import { Suppliers } from './collections/catalog/Suppliers'
import { Orders } from './collections/commerce/Orders'
import { PaymentEvents } from './collections/commerce/PaymentEvents'
import { Consents } from './collections/customers/Consents'
import { Customers } from './collections/customers/Customers'
import { Lots } from './collections/inventory/Lots'
import { StockMovements } from './collections/inventory/StockMovements'
import { Blocks } from './collections/knowledge/Blocks'
import { Domains } from './collections/knowledge/Domains'
import { Ingredients } from './collections/knowledge/Ingredients'
import { Rhythms } from './collections/knowledge/Rhythms'
import { Sources } from './collections/knowledge/Sources'
import { AuditLog } from './collections/system/AuditLog'
import { Media } from './collections/system/Media'
import { PrivateFiles } from './collections/system/PrivateFiles'
import { Users } from './collections/team/Users'
import { ShopSettings } from './globals/ShopSettings'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    meta: { titleSuffix: ' · Newtons' },
    importMap: { baseDir: path.resolve(dirname) },
  },
  // Idioma del panel: el del navegador entre español, alemán e inglés.
  i18n: {
    supportedLanguages: { es, de, en },
    fallbackLanguage: 'es',
  },
  // Contenido: español = idioma editorial de origen (interno); alemán =
  // idioma principal para clientes; inglés = secundario. Francés e italiano
  // se pueden añadir aquí. Sin fallback: un idioma no aprobado no se rellena
  // con otro (decisión del 7-10-2026).
  localization: {
    locales: [
      { label: 'Español (editorial)', code: 'es' },
      { label: 'Deutsch', code: 'de' },
      { label: 'English', code: 'en' },
    ],
    defaultLocale: 'es',
    fallback: false,
  },
  collections: [
    // Conocimiento
    Ingredients,
    Domains,
    Rhythms,
    Blocks,
    Sources,
    // Catálogo
    Products,
    Formulations,
    Suppliers,
    ProductSubmissions,
    // Inventario
    Lots,
    StockMovements,
    // Pedidos
    Orders,
    PaymentEvents,
    // Clientes y su seguimiento (solo visible para cada cliente)
    Customers,
    Consents,
    CustomerProducts,
    Plans,
    PlanItems,
    IntakeLogs,
    Reviews,
    SymptomReports,
    // Sistema
    Users,
    AuditLog,
    Media,
    PrivateFiles,
  ],
  globals: [ShopSettings],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URL || '' },
  }),
  sharp,
})
