/** Care Profile routes — CRUD for profiles within a group. */
import { Router, Request, Response } from 'express'
import { eq, and } from 'drizzle-orm'
import { db } from '../db'
import { careProfiles, groupMembers } from '@carehub/shared'
import { requireAuth } from '../middleware/auth'

export const profilesRouter = Router({ mergeParams: true })

/** Verify the authenticated user is an admin of the given group. Returns the membership or null. */
async function getAdminMembership(userId: string, groupId: string) {
  const [membership] = await db
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.group_id, groupId), eq(groupMembers.user_id, userId)))
    .limit(1)

  if (!membership) return null
  return membership
}

// POST /api/groups/:groupId/profiles
profilesRouter.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const groupId = req.params['groupId'] as string
    const { name, date_of_birth, relationship, conditions } = req.body as {
      name?: string
      date_of_birth?: string
      relationship?: string
      conditions?: string[]
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'name is required' })
      return
    }

    const membership = await getAdminMembership(req.user!.userId, groupId)
    if (!membership) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }
    if (membership.role !== 'admin') {
      res.status(403).json({ error: 'Only admins can create profiles' })
      return
    }

    const [profile] = await db
      .insert(careProfiles)
      .values({
        group_id: groupId,
        name: name.trim(),
        date_of_birth: date_of_birth ?? null,
        relationship: relationship ?? null,
        conditions: Array.isArray(conditions) ? conditions : [],
      })
      .returning()

    res.status(201).json(profile)
  } catch (err) {
    console.error('POST /groups/:groupId/profiles error:', err)
    res.status(500).json({ error: 'Failed to create profile' })
  }
})

// GET /api/groups/:groupId/profiles
profilesRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const groupId = req.params['groupId'] as string

    const membership = await getAdminMembership(req.user!.userId, groupId)
    if (!membership) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }

    const profiles = await db.select().from(careProfiles).where(eq(careProfiles.group_id, groupId))

    res.json(profiles)
  } catch (err) {
    console.error('GET /groups/:groupId/profiles error:', err)
    res.status(500).json({ error: 'Failed to fetch profiles' })
  }
})

// GET /api/groups/:groupId/profiles/:id
profilesRouter.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const groupId = req.params['groupId'] as string
    const id = req.params['id'] as string

    const membership = await getAdminMembership(req.user!.userId, groupId)
    if (!membership) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }

    const [profile] = await db
      .select()
      .from(careProfiles)
      .where(and(eq(careProfiles.id, id), eq(careProfiles.group_id, groupId)))
      .limit(1)

    if (!profile) {
      res.status(404).json({ error: 'Profile not found' })
      return
    }

    res.json(profile)
  } catch (err) {
    console.error('GET /groups/:groupId/profiles/:id error:', err)
    res.status(500).json({ error: 'Failed to fetch profile' })
  }
})

// PATCH /api/groups/:groupId/profiles/:id
profilesRouter.patch('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const groupId = req.params['groupId'] as string
    const id = req.params['id'] as string
    const { name, date_of_birth, relationship, conditions } = req.body as {
      name?: string
      date_of_birth?: string | null
      relationship?: string | null
      conditions?: string[]
    }

    const membership = await getAdminMembership(req.user!.userId, groupId)
    if (!membership) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }
    if (membership.role !== 'admin') {
      res.status(403).json({ error: 'Only admins can update profiles' })
      return
    }

    // Build partial update object
    const updates: Partial<{
      name: string
      date_of_birth: string | null
      relationship: string | null
      conditions: string[]
      updated_at: Date
    }> = { updated_at: new Date() }

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ error: 'name cannot be empty' })
        return
      }
      updates.name = name.trim()
    }
    if (date_of_birth !== undefined) updates.date_of_birth = date_of_birth
    if (relationship !== undefined) updates.relationship = relationship
    if (conditions !== undefined) updates.conditions = Array.isArray(conditions) ? conditions : []

    const [updated] = await db
      .update(careProfiles)
      .set(updates)
      .where(and(eq(careProfiles.id, id), eq(careProfiles.group_id, groupId)))
      .returning()

    if (!updated) {
      res.status(404).json({ error: 'Profile not found' })
      return
    }

    res.json(updated)
  } catch (err) {
    console.error('PATCH /groups/:groupId/profiles/:id error:', err)
    res.status(500).json({ error: 'Failed to update profile' })
  }
})

// DELETE /api/groups/:groupId/profiles/:id
profilesRouter.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const groupId = req.params['groupId'] as string
    const id = req.params['id'] as string

    const membership = await getAdminMembership(req.user!.userId, groupId)
    if (!membership) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }
    if (membership.role !== 'admin') {
      res.status(403).json({ error: 'Only admins can delete profiles' })
      return
    }

    const [deleted] = await db
      .delete(careProfiles)
      .where(and(eq(careProfiles.id, id), eq(careProfiles.group_id, groupId)))
      .returning()

    if (!deleted) {
      res.status(404).json({ error: 'Profile not found' })
      return
    }

    res.status(204).send()
  } catch (err) {
    console.error('DELETE /groups/:groupId/profiles/:id error:', err)
    res.status(500).json({ error: 'Failed to delete profile' })
  }
})
