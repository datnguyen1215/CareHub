/**
 * Migration runner — executes all pending SQL migrations from the migrations folder.
 * Run via: npm run db:migrate
 */
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import path from 'path'
import { logger } from '../services/logger.js'

const migrationsFolder = path.join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'packages',
  'shared',
  'migrations'
)

async function runMigrations(
  url: string = process.env.DATABASE_URL ??
    'postgresql://carehub:carehub_dev@localhost:9392/carehub'
) {
  const pool = new Pool({ connectionString: url })
  const db = drizzle(pool)

  logger.info('Running migrations against: %s', url.replace(/:[^:@]+@/, ':***@'))
  await migrate(db, { migrationsFolder })
  logger.info('Migrations complete')

  await pool.end()
}

const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL
runMigrations(url).catch((err) => {
  logger.error({ err }, 'Migration failed')
  process.exit(1)
})
