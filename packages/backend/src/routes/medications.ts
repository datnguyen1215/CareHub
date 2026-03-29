/** Medication routes — CRUD for medications within a care profile. */
import { Router, Request, Response } from 'express'
import { eq, and } from 'drizzle-orm'
import { db } from '../db'
import { medications, groupMembers, careProfiles } from '@carehub/shared'
import { requireAuth } from '../middleware/auth'

export const medicationsRouter = Router({ mergeParams: true })

/** Verify the authenticated user is a member of the given group. Returns the membership or null. */
async function getMembership(userId: string, groupId: string) {
  const [membership] = await db
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.group_id, groupId), eq(groupMembers.user_id, userId)))
    .limit(1)

  return membership ?? null
}

/** Verify the profile belongs to the group. Returns the profile or null. */
async function getProfileInGroup(profileId: string, groupId: string) {
  const [profile] = await db
    .select()
    .from(careProfiles)
    .where(and(eq(careProfiles.id, profileId), eq(careProfiles.group_id, groupId)))
    .limit(1)

  return profile ?? null
}

const VALID_SCHEDULE = ['morning', 'afternoon', 'evening', 'bedtime']

// POST /api/groups/:groupId/profiles/:profileId/medications
medicationsRouter.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const groupId = req.params['groupId'] as string
    const profileId = req.params['profileId'] as string
    const { name, dosage, schedule, status } = req.body as {
      name?: string
      dosage?: string
      schedule?: string[]
      status?: string
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'name is required' })
      return
    }

    const membership = await getMembership(req.user!.userId, groupId)
    if (!membership) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }

    const profile = await getProfileInGroup(profileId, groupId)
    if (!profile) {
      res.status(404).json({ error: 'Profile not found' })
      return
    }

    const scheduleValue = Array.isArray(schedule)
      ? schedule.filter((s) => VALID_SCHEDULE.includes(s))
      : []

    const [medication] = await db
      .insert(medications)
      .values({
        care_profile_id: profileId,
        name: name.trim(),
        dosage: dosage ?? null,
        schedule: scheduleValue,
        status: status === 'discontinued' ? 'discontinued' : 'active',
      })
      .returning()

    res.status(201).json(medication)
  } catch (err) {
    console.error('POST medications error:', err)
    res.status(500).json({ error: 'Failed to create medication' })
  }
})

// GET /api/groups/:groupId/profiles/:profileId/medications
medicationsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const groupId = req.params['groupId'] as string
    const profileId = req.params['profileId'] as string
    const includeDiscontinued = req.query['include_discontinued'] === 'true'

    const membership = await getMembership(req.user!.userId, groupId)
    if (!membership) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }

    const profile = await getProfileInGroup(profileId, groupId)
    if (!profile) {
      res.status(404).json({ error: 'Profile not found' })
      return
    }

    const rows = includeDiscontinued
      ? await db.select().from(medications).where(eq(medications.care_profile_id, profileId))
      : await db
          .select()
          .from(medications)
          .where(and(eq(medications.care_profile_id, profileId), eq(medications.status, 'active')))

    res.json(rows)
  } catch (err) {
    console.error('GET medications error:', err)
    res.status(500).json({ error: 'Failed to fetch medications' })
  }
})

// PATCH /api/groups/:groupId/profiles/:profileId/medications/:id
medicationsRouter.patch('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const groupId = req.params['groupId'] as string
    const profileId = req.params['profileId'] as string
    const id = req.params['id'] as string
    const { name, dosage, schedule, status } = req.body as {
      name?: string
      dosage?: string | null
      schedule?: string[]
      status?: string
    }

    const membership = await getMembership(req.user!.userId, groupId)
    if (!membership) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }

    const profile = await getProfileInGroup(profileId, groupId)
    if (!profile) {
      res.status(404).json({ error: 'Profile not found' })
      return
    }

    const updates: Partial<{
      name: string
      dosage: string | null
      schedule: string[]
      status: 'active' | 'discontinued'
      updated_at: Date
    }> = { updated_at: new Date() }

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ error: 'name cannot be empty' })
        return
      }
      updates.name = name.trim()
    }
    if (dosage !== undefined) updates.dosage = dosage
    if (schedule !== undefined) {
      updates.schedule = Array.isArray(schedule)
        ? schedule.filter((s) => VALID_SCHEDULE.includes(s))
        : []
    }
    if (status !== undefined) {
      if (status !== 'active' && status !== 'discontinued') {
        res.status(400).json({ error: 'status must be active or discontinued' })
        return
      }
      updates.status = status
    }

    const [updated] = await db
      .update(medications)
      .set(updates)
      .where(and(eq(medications.id, id), eq(medications.care_profile_id, profileId)))
      .returning()

    if (!updated) {
      res.status(404).json({ error: 'Medication not found' })
      return
    }

    res.json(updated)
  } catch (err) {
    console.error('PATCH medications error:', err)
    res.status(500).json({ error: 'Failed to update medication' })
  }
})

// DELETE /api/groups/:groupId/profiles/:profileId/medications/:id
medicationsRouter.delete(
  '/:id',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const groupId = req.params['groupId'] as string
      const profileId = req.params['profileId'] as string
      const id = req.params['id'] as string

      const membership = await getMembership(req.user!.userId, groupId)
      if (!membership) {
        res.status(403).json({ error: 'Forbidden' })
        return
      }

      const profile = await getProfileInGroup(profileId, groupId)
      if (!profile) {
        res.status(404).json({ error: 'Profile not found' })
        return
      }

      const [deleted] = await db
        .delete(medications)
        .where(and(eq(medications.id, id), eq(medications.care_profile_id, profileId)))
        .returning()

      if (!deleted) {
        res.status(404).json({ error: 'Medication not found' })
        return
      }

      res.status(204).send()
    } catch (err) {
      console.error('DELETE medications error:', err)
      res.status(500).json({ error: 'Failed to delete medication' })
    }
  }
)
