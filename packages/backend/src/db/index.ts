import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '@carehub/shared'

let _pool: Pool | null = null
let _db: NodePgDatabase<typeof schema> | null = null

/**
 * Get the database pool instance.
 * Uses lazy initialization to avoid creating connections at module load time.
 * This is important for test isolation - tests can mock this module without
 * triggering real database connections.
 */
function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({
      connectionString:
        process.env.DATABASE_URL ?? 'postgresql://carehub:carehub_dev@localhost:5432/carehub',
      max: 20,
    })
  }
  return _pool
}

/**
 * Get the drizzle database instance.
 * Uses lazy initialization to avoid creating connections at module load time.
 */
function getDb(): NodePgDatabase<typeof schema> {
  if (!_db) {
    _db = drizzle(getPool(), { schema })
  }
  return _db
}

/**
 * Close the database pool. Call this during graceful shutdown.
 */
export async function closePool(): Promise<void> {
  if (_pool) {
    await _pool.end()
    _pool = null
    _db = null
  }
}

/**
 * Lazily-initialized database instance.
 * The pool is only created when first accessed, not at module load time.
 */
export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, prop) {
    return Reflect.get(getDb(), prop)
  },
})

/**
 * Lazily-initialized connection pool.
 * The pool is only created when first accessed, not at module load time.
 */
export const pool = new Proxy({} as Pool, {
  get(_target, prop) {
    return Reflect.get(getPool(), prop)
  },
})
