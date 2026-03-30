/**
 * Vitest global test setup.
 * Connects to the test database and runs all migrations before the test suite.
 * Ensures proper cleanup of all resources to prevent memory leaks.
 */
import { beforeAll, afterAll, afterEach, vi } from 'vitest'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import path from 'path'
import { fileURLToPath } from 'url'
import { env } from '../src/config/env.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const migrationsFolder = path.join(__dirname, '../../shared/migrations')

let migrationPool: Pool | null = null

beforeAll(async () => {
  const url = env.DATABASE_URL_TEST

  try {
    // Use a dedicated pool for migrations with a single connection
    migrationPool = new Pool({
      connectionString: url,
      max: 1,
    })
    const db = drizzle(migrationPool)
    await migrate(db, { migrationsFolder })
    console.log('Test DB migrations applied')
  } catch (err) {
    // If migrations folder doesn't exist yet (no generated migrations), skip gracefully.
    // Any other error (e.g. DB unreachable, bad credentials) is fatal — rethrow so
    // tests fail fast rather than running against an un-migrated schema.
    const message = err instanceof Error ? err.message : String(err)
    if (
      message.includes('no such file') ||
      message.includes('ENOENT') ||
      message.includes('_journal.json')
    ) {
      console.warn('No migration files found — skipping test DB migration')
    } else {
      throw err
    }
  }
})

afterEach(() => {
  // Reset all mocks after each test to prevent state leakage
  vi.resetAllMocks()
})

afterAll(async () => {
  // Close migration pool if it was successfully created
  if (migrationPool) {
    try {
      await migrationPool.end()
    } catch (err) {
      console.error('Error closing migration pool:', err)
    } finally {
      migrationPool = null
    }
  }

  // Clear all mocks and timers
  vi.clearAllMocks()
  vi.clearAllTimers()
  vi.useRealTimers()
})
