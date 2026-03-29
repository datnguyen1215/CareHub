/**
 * Vitest global test setup.
 * Connects to the test database and runs all migrations before the test suite.
 */
import { beforeAll, afterAll } from 'vitest'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import path from 'path'
import { fileURLToPath } from 'url'
import { env } from '../src/config/env.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const migrationsFolder = path.join(__dirname, '../src/db/migrations')

let migrationClient: postgres.Sql | null = null

beforeAll(async () => {
  const url = env.DATABASE_URL_TEST

  try {
    migrationClient = postgres(url, { max: 1 })
    const db = drizzle(migrationClient)
    await migrate(db, { migrationsFolder })
    console.log('Test DB migrations applied')
  } catch (err) {
    // If migrations folder doesn't exist yet (no generated migrations), skip
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('no such file') || message.includes('ENOENT')) {
      console.warn('No migration files found — skipping test DB migration')
    } else {
      console.warn('Migration warning (continuing):', message)
    }
  }
})

afterAll(async () => {
  await migrationClient?.end()
})
