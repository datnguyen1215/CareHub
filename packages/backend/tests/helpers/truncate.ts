/**
 * Database truncation utilities for test isolation.
 * Clears all tables before each test file to ensure clean state.
 */
import { sql } from 'drizzle-orm'
import { db } from '../../src/db'

/**
 * Truncate all tables in the test database.
 * Runs TRUNCATE CASCADE to remove all data while preserving schema.
 * Call this in beforeAll() of each test file.
 */
export async function truncateAll(): Promise<void> {
  await db.execute(sql`
    TRUNCATE TABLE
      users,
      care_profiles,
      profile_shares,
      medications,
      otps
    CASCADE
  `)
}
