/** Medication routes — CRUD for medications within a care profile. */
import { Router, Request, Response } from 'express'
import { eq, and } from 'drizzle-orm'
import { db } from '../db'
import { medications, careProfiles, profileShares } from '@carehub/shared'
import { requireAuth } from '../middleware/auth'
import { logger } from '../services/logger'
import { validate } from '../middleware/validate'
import { createMedicationSchema, updateMedicationSchema } from '../schemas/medications'

export const medicationsRouter = Router({ mergeParams: true })

/** Check if user can access a profile (owner or shared with them) */
async function canAccessProfile(userId: string, profileId: string) {
  const [profile] = await db
    .select()
    .from(careProfiles)
    .where(eq(careProfiles.id, profileId))
    .limit(1)

  if (!profile) return null

  // Check if user owns the profile
  if (profile.user_id === userId) {
    return profile
  }

  // Check if profile is shared with user
  const [share] = await db
    .select()
    .from(profileShares)
    .where(and(eq(profileShares.profile_id, profileId), eq(profileShares.user_id, userId)))
    .limit(1)

  if (share) {
    return profile
  }

  return null
}

// POST /api/profiles/:profileId/medications
medicationsRouter.post('/', requireAuth, validate(createMedicationSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const profileId = req.params['profileId'] as string
    const { name, dosage, schedule, status } = req.body as {
      name: string
      dosage?: string | null
      schedule?: string[]
      status?: string
    }

    const profile = await canAccessProfile(req.user!.userId, profileId)
    if (!profile) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }

    const scheduleValue = Array.isArray(schedule) ? schedule : []

    const [medication] = await db
      .insert(medications)
      .values({
        care_profile_id: profileId,
        name,
        dosage: dosage ?? null,
        schedule: scheduleValue,
        status: status === 'discontinued' ? 'discontinued' : 'active',
      })
      .returning()

    res.status(201).json(medication)
  } catch (err) {
    logger.error({ err }, 'POST medications error')
    res.status(500).json({ error: 'Failed to create medication' })
  }
})

// GET /api/profiles/:profileId/medications
medicationsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const profileId = req.params['profileId'] as string
    const includeDiscontinued = req.query['include_discontinued'] === 'true'

    const profile = await canAccessProfile(req.user!.userId, profileId)
    if (!profile) {
      res.status(403).json({ error: 'Forbidden' })
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
    logger.error({ err }, 'GET medications error')
    res.status(500).json({ error: 'Failed to fetch medications' })
  }
})

// PATCH /api/profiles/:profileId/medications/:id
medicationsRouter.patch('/:id', requireAuth, validate(updateMedicationSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const profileId = req.params['profileId'] as string
    const id = req.params['id'] as string
    const { name, dosage, schedule, status } = req.body as {
      name?: string
      dosage?: string | null
      schedule?: string[]
      status?: 'active' | 'discontinued'
    }

    const profile = await canAccessProfile(req.user!.userId, profileId)
    if (!profile) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }

    const updates: Partial<{
      name: string
      dosage: string | null
      schedule: string[]
      status: 'active' | 'discontinued'
      updated_at: Date
    }> = { updated_at: new Date() }

    if (name !== undefined) updates.name = name
    if (dosage !== undefined) updates.dosage = dosage
    if (schedule !== undefined) updates.schedule = Array.isArray(schedule) ? schedule : []
    if (status !== undefined) updates.status = status

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
    logger.error({ err }, 'PATCH medications error')
    res.status(500).json({ error: 'Failed to update medication' })
  }
})

// DELETE /api/profiles/:profileId/medications/:id
medicationsRouter.delete(
  '/:id',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const profileId = req.params['profileId'] as string
      const id = req.params['id'] as string

      const profile = await canAccessProfile(req.user!.userId, profileId)
      if (!profile) {
        res.status(403).json({ error: 'Forbidden' })
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
      logger.error({ err }, 'DELETE medications error')
      res.status(500).json({ error: 'Failed to delete medication' })
    }
  }
)
