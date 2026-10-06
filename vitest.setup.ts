// Load .env files
import 'dotenv/config'

// Las pruebas de integración usan su propia base de datos: nunca la de la demo.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgres://newtons:newtons@127.0.0.1:5433/newtons_test'
