import type { Config } from 'drizzle-kit'

export default {
  schema: './src/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://carehub:carehub_dev@localhost:5432/carehub',
  },
} satisfies Config
