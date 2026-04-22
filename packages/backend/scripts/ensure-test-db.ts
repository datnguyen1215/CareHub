/**
 * Idempotent script that creates the carehub_test database if it doesn't exist.
 * Connects to the server-level "postgres" database to issue CREATE DATABASE.
 * Exits 0 on success, non-zero on connection failure.
 */

import { Client } from 'pg'

const DEFAULT_TEST_URL = 'postgresql://carehub:carehub_dev@localhost:9392/carehub_test'

function parseDbName(url: string): string {
  const parsed = new URL(url)
  // pathname is like "/carehub_test"
  return parsed.pathname.replace(/^\//, '')
}

function serverUrl(url: string): string {
  const parsed = new URL(url)
  parsed.pathname = '/postgres'
  return parsed.toString()
}

async function main() {
  const testUrl = process.env.DATABASE_URL_TEST ?? DEFAULT_TEST_URL
  const dbName = parseDbName(testUrl)
  const connUrl = serverUrl(testUrl)

  const client = new Client({ connectionString: connUrl })

  try {
    await client.connect()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`\nERROR: Could not connect to Postgres: ${message}`)
    console.error('Is the database running? Try: docker compose up -d db\n')
    process.exit(1)
  }

  try {
    const result = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName]
    )

    if (result.rowCount === 0) {
      // Double-quote quoting is the correct PostgreSQL identifier escaping; dbName comes from DATABASE_URL_TEST (developer-controlled), not user input
      await client.query(`CREATE DATABASE "${dbName}"`)
      console.log(`Created database: ${dbName}`)
    } else {
      console.log(`Database already exists: ${dbName}`)
    }
  } finally {
    await client.end()
  }
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
