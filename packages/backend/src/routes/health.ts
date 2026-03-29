import { Router } from 'express'
import { db } from '../db/index.js'
import { sql } from 'drizzle-orm'

const router = Router()

/**
 * GET /health
 * Returns server and database health status.
 */
router.get('/', async (_req, res) => {
  try {
    // Verify DB connectivity with a lightweight query
    await db.execute(sql`SELECT 1`)
    res.json({ status: 'ok' })
  } catch (err) {
    console.error('Health check failed:', err)
    res.status(503).json({ status: 'error', message: 'Database unavailable' })
  }
})

export default router
