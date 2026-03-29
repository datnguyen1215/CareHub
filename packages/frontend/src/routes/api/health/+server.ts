/** Health check endpoint — verifies API and database connectivity. */
import { json } from '@sveltejs/kit'
import { pool } from '$lib/server/db'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async () => {
  try {
    // Test database connection
    await pool.query('SELECT 1')
    return json({ status: 'ok' })
  } catch (error) {
    return json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    )
  }
}
