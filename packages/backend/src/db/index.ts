import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '../config/env.js'
import * as schema from './schema/index.js'

/**
 * Creates a Drizzle database client connected to the given URL.
 */
export function createDb(url: string = env.DATABASE_URL) {
  const client = postgres(url)
  return drizzle(client, { schema })
}

/**
 * Shared database instance for the application.
 *
 * NOTE: This opens a postgres connection pool at import time.
 * In tests, either:
 *   - mock this module with `vi.mock('../db/index.js')`, or
 *   - ensure `DATABASE_URL` is set and points to the test DB.
 * Failure to do one of these will cause live connection attempts in every
 * test that transitively imports this module.
 */
export const db = createDb()

export type Db = ReturnType<typeof createDb>
