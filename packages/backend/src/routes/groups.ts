/** Groups routes — create, rename, and list groups. */
import { Router, Request, Response } from 'express'
import { eq, and } from 'drizzle-orm'
import { db } from '../db'
import { groups, groupMembers } from '@carehub/shared'
import { requireAuth } from '../middleware/auth'
import { logger } from '../services/logger'

export const groupsRouter = Router()

// POST /api/groups — create a group and add the creator as admin
groupsRouter.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body as { name?: string }

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'name is required' })
      return
    }

    const group = await db.transaction(async (tx) => {
      const [created] = await tx.insert(groups).values({ name: name.trim() }).returning()

      await tx.insert(groupMembers).values({
        user_id: req.user!.userId,
        group_id: created.id,
        role: 'admin',
      })

      return created
    })

    res.status(201).json(group)
  } catch (err) {
    logger.error({ err }, 'POST /groups error')
    res.status(500).json({ error: 'Failed to create group' })
  }
})

// PATCH /api/groups/:id — rename a group (admin only)
groupsRouter.patch('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string
    const { name } = req.body as { name?: string }

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'name is required' })
      return
    }

    // Check the user is an admin of the group
    const [membership] = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.group_id, id), eq(groupMembers.user_id, req.user!.userId)))
      .limit(1)

    if (!membership) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }

    if (membership.role !== 'admin') {
      res.status(403).json({ error: 'Only admins can rename the group' })
      return
    }

    const [updated] = await db
      .update(groups)
      .set({ name: name.trim() })
      .where(eq(groups.id, id))
      .returning()

    if (!updated) {
      res.status(404).json({ error: 'Group not found' })
      return
    }

    res.json(updated)
  } catch (err) {
    logger.error({ err }, 'PATCH /groups/:id error')
    res.status(500).json({ error: 'Failed to rename group' })
  }
})

// GET /api/groups — list all groups the authenticated user belongs to
groupsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const rows = await db
      .select({ group: groups })
      .from(groupMembers)
      .innerJoin(groups, eq(groupMembers.group_id, groups.id))
      .where(eq(groupMembers.user_id, req.user!.userId))

    res.json(rows.map((r) => r.group))
  } catch (err) {
    logger.error({ err }, 'GET /groups error')
    res.status(500).json({ error: 'Failed to fetch groups' })
  }
})
