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

/** Shared database instance for the application */
export const db = createDb()

export type Db = ReturnType<typeof createDb>
