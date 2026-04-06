import { Router, Request, Response } from 'express'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { users } from '@carehub/shared'
import { requireAuth } from '../middleware/auth.js'
import { logger } from '../services/logger.js'

export const usersRouter = Router()

// GET /api/users/me
usersRouter.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.user!.userId)).limit(1)

    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    res.json(user)
  } catch (err) {
    logger.error({ err }, 'GET /users/me error')
    res.status(500).json({ error: 'Failed to fetch user' })
  }
})

// PATCH /api/users/me — account setup
usersRouter.patch('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { first_name, last_name } = req.body as { first_name?: string; last_name?: string }

    if (!first_name && !last_name) {
      res.status(400).json({ error: 'At least one of first_name or last_name is required' })
      return
    }

    const [user] = await db
      .update(users)
      .set({ first_name, last_name })
      .where(eq(users.id, req.user!.userId))
      .returning()

    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    res.json(user)
  } catch (err) {
    logger.error({ err }, 'PATCH /users/me error')
    res.status(500).json({ error: 'Failed to update user' })
  }
})
