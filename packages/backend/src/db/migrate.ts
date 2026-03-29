/**
 * Migration runner — executes all pending SQL migrations from the migrations folder.
 * Run via: npm run db:migrate
 */
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import path from 'path'
import { fileURLToPath } from 'url'
import { env } from '../config/env.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const migrationsFolder = path.join(__dirname, 'migrations')

async function runMigrations(url: string = env.DATABASE_URL) {
  const client = postgres(url, { max: 1 })
  const db = drizzle(client)

  console.log('Running migrations against:', url.replace(/:[^:@]+@/, ':***@'))
  await migrate(db, { migrationsFolder })
  console.log('Migrations complete')

  await client.end()
}

const url = process.env.DATABASE_URL_TEST ?? env.DATABASE_URL
runMigrations(url).catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
