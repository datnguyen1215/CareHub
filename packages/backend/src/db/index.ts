import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '@carehub/shared'

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ?? 'postgresql://carehub:carehub_dev@localhost:5432/carehub',
})

export const db = drizzle(pool, { schema })
export { pool }
