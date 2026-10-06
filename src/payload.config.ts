import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { de } from '@payloadcms/translations/languages/de'
import { es } from '@payloadcms/translations/languages/es'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { IntakeLogs } from './collections/care/IntakeLogs'
import { PlanItems } from './collections/care/PlanItems'
import { Plans } from './collections/care/Plans'
import { Reviews } from './collections/care/Reviews'
import { SymptomReports } from './collections/care/SymptomReports'
import { Formulations } from './collections/catalog/Formulations'
import { Products } from './collections/catalog/Products'
import { Assortment } from './collections/chains/Assortment'
import { Chains } from './collections/chains/Chains'
import { Stores } from './collections/chains/Stores'
import { Users } from './collections/chains/Users'
import { Consents } from './collections/customers/Consents'
import { CustomerLinks } from './collections/customers/CustomerLinks'
import { Customers } from './collections/customers/Customers'
import { Invitations } from './collections/customers/Invitations'
import { Blocks } from './collections/knowledge/Blocks'
import { Domains } from './collections/knowledge/Domains'
import { Ingredients } from './collections/knowledge/Ingredients'
import { Rhythms } from './collections/knowledge/Rhythms'
import { Sources } from './collections/knowledge/Sources'
import { AuditLog } from './collections/system/AuditLog'
import { Media } from './collections/system/Media'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    meta: { titleSuffix: ' · Newtons' },
    importMap: { baseDir: path.resolve(dirname) },
  },
  // Panel en español por defecto (y alemán). Sin inglés: un navegador en
  // inglés recibe el panel en español.
  i18n: {
    supportedLanguages: { es, de },
    fallbackLanguage: 'es',
  },
  // Español: idioma editorial de origen. Alemán de Suiza: idioma comercial
  // inicial. Sin fallback: un idioma no aprobado no se rellena con otro
  // (Libro 2, n.º 36).
  localization: {
    locales: [
      { label: 'Español', code: 'es' },
      { label: 'Deutsch (Schweiz)', code: 'de-CH' },
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
    // Droguerías
    Chains,
    Stores,
    Assortment,
    Users,
    // Clientes y planes
    Customers,
    CustomerLinks,
    Invitations,
    Consents,
    Plans,
    PlanItems,
    IntakeLogs,
    Reviews,
    SymptomReports,
    // Sistema
    AuditLog,
    Media,
  ],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URL || '' },
  }),
  sharp,
})
