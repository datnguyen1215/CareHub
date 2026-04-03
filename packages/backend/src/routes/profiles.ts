/** Care Profile routes — CRUD for profiles owned by users. */
import { Router, Request, Response } from 'express'
import { eq, and, sql } from 'drizzle-orm'
import { db } from '../db'
import { careProfiles, profileShares, medications } from '@carehub/shared'
import { requireAuth } from '../middleware/auth'
import { logger } from '../services/logger'
import { validate } from '../middleware/validate'
import { createProfileSchema, updateProfileSchema } from '../schemas/profiles'
import { canViewProfile, canEditProfile, isProfileOwner } from '../services/access'

export const profilesRouter = Router()

// POST /api/profiles
profilesRouter.post('/', requireAuth, validate(createProfileSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, date_of_birth, relationship, conditions, avatar_url } = req.body as {
      name: string
      date_of_birth?: string
      relationship?: string | null
      conditions?: string[]
      avatar_url?: string | null
    }

    const [profile] = await db
      .insert(careProfiles)
      .values({
        user_id: req.user!.userId,
        name,
        date_of_birth: date_of_birth ?? null,
        relationship: relationship ?? null,
        conditions: Array.isArray(conditions) ? conditions : [],
        avatar_url: avatar_url ?? null,
      })
      .returning()

    res.status(201).json(profile)
  } catch (err) {
    logger.error({ err }, 'POST /profiles error')
    res.status(500).json({ error: 'Failed to create profile' })
  }
})

// GET /api/profiles
profilesRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId

    // Subquery for medication count (only active medications)
    const medicationCountSubquery = db
      .select({
        care_profile_id: medications.care_profile_id,
        count: sql<number>`count(*)::int`.as('count'),
      })
      .from(medications)
      .where(eq(medications.status, 'active'))
      .groupBy(medications.care_profile_id)
      .as('med_counts')

    // Get profiles user owns with medication count
    const ownedProfiles = await db
      .select({
        id: careProfiles.id,
        user_id: careProfiles.user_id,
        name: careProfiles.name,
        avatar_url: careProfiles.avatar_url,
        date_of_birth: careProfiles.date_of_birth,
        relationship: careProfiles.relationship,
        conditions: careProfiles.conditions,
        created_at: careProfiles.created_at,
        updated_at: careProfiles.updated_at,
        medication_count: sql<number>`coalesce(${medicationCountSubquery.count}, 0)`.as(
          'medication_count'
        ),
      })
      .from(careProfiles)
      .leftJoin(medicationCountSubquery, eq(careProfiles.id, medicationCountSubquery.care_profile_id))
      .where(eq(careProfiles.user_id, userId))

    // Get profiles shared with user with medication count
    const sharedRows = await db
      .select({
        profile: {
          id: careProfiles.id,
          user_id: careProfiles.user_id,
          name: careProfiles.name,
          avatar_url: careProfiles.avatar_url,
          date_of_birth: careProfiles.date_of_birth,
          relationship: careProfiles.relationship,
          conditions: careProfiles.conditions,
          created_at: careProfiles.created_at,
          updated_at: careProfiles.updated_at,
          medication_count: sql<number>`coalesce(${medicationCountSubquery.count}, 0)`.as(
            'medication_count'
          ),
        },
      })
      .from(profileShares)
      .innerJoin(careProfiles, eq(profileShares.profile_id, careProfiles.id))
      .leftJoin(medicationCountSubquery, eq(careProfiles.id, medicationCountSubquery.care_profile_id))
      .where(eq(profileShares.user_id, userId))

    const sharedProfiles = sharedRows.map((r) => r.profile)

    // Combine and dedupe (in case of any overlap, though shouldn't happen)
    const allProfiles = [...ownedProfiles, ...sharedProfiles]
    const seen = new Set<string>()
    const uniqueProfiles = allProfiles.filter((p) => {
      if (seen.has(p.id)) return false
      seen.add(p.id)
      return true
    })

    res.json(uniqueProfiles)
  } catch (err) {
    logger.error({ err }, 'GET /profiles error')
    res.status(500).json({ error: 'Failed to fetch profiles' })
  }
})

// GET /api/profiles/:id
profilesRouter.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string

    const access = await canViewProfile(req.user!.userId, id)
    if (!access) {
      res.status(404).json({ error: 'Profile not found' })
      return
    }

    res.json(access.profile)
  } catch (err) {
    logger.error({ err }, 'GET /profiles/:id error')
    res.status(500).json({ error: 'Failed to fetch profile' })
  }
})

// PATCH /api/profiles/:id
profilesRouter.patch('/:id', requireAuth, validate(updateProfileSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string
    const { name, date_of_birth, relationship, conditions, avatar_url } = req.body as {
      name?: string
      date_of_birth?: string | null
      relationship?: string | null
      conditions?: string[]
      avatar_url?: string | null
    }

    const access = await canEditProfile(req.user!.userId, id)
    if (!access) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }

    // Build partial update object
    const updates: Partial<{
      name: string
      date_of_birth: string | null
      relationship: string | null
      conditions: string[]
      avatar_url: string | null
      updated_at: Date
    }> = { updated_at: new Date() }

    if (name !== undefined) updates.name = name
    if (date_of_birth !== undefined) updates.date_of_birth = date_of_birth === '' ? null : date_of_birth
    if (relationship !== undefined) updates.relationship = relationship
    if (conditions !== undefined) updates.conditions = Array.isArray(conditions) ? conditions : []
    if (avatar_url !== undefined) updates.avatar_url = avatar_url

    const [updated] = await db
      .update(careProfiles)
      .set(updates)
      .where(eq(careProfiles.id, id))
      .returning()

    if (!updated) {
      res.status(404).json({ error: 'Profile not found' })
      return
    }

    res.json(updated)
  } catch (err) {
    logger.error({ err }, 'PATCH /profiles/:id error')
    res.status(500).json({ error: 'Failed to update profile' })
  }
})

// DELETE /api/profiles/:id
profilesRouter.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string

    // Only owner can delete
    const profile = await isProfileOwner(req.user!.userId, id)
    if (!profile) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }

    const [deleted] = await db.delete(careProfiles).where(eq(careProfiles.id, id)).returning()

    if (!deleted) {
      res.status(404).json({ error: 'Profile not found' })
      return
    }

    res.status(204).send()
  } catch (err) {
    logger.error({ err }, 'DELETE /profiles/:id error')
    res.status(500).json({ error: 'Failed to delete profile' })
  }
})
