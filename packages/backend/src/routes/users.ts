import { Router, Request, Response } from 'express'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { users } from '@carehub/shared'
import { requireAuth } from '../middleware/auth'

export const usersRouter = Router()

// GET /api/users/me
usersRouter.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const [user] = await db.select().from(users).where(eq(users.id, req.user!.userId)).limit(1)

  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  res.json(user)
})

// PATCH /api/users/me — account setup
usersRouter.patch('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { first_name, last_name } = req.body as { first_name?: string; last_name?: string }

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
})
