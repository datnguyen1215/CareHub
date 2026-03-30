/** Care Profile routes — CRUD for profiles owned by users. */
import { Router, Request, Response } from 'express'
import { eq, and } from 'drizzle-orm'
import { db } from '../db'
import { careProfiles, profileShares } from '@carehub/shared'
import { requireAuth } from '../middleware/auth'
import { logger } from '../services/logger'

export const profilesRouter = Router()

/** Check if user can view a profile (owner or shared with them) */
async function canViewProfile(userId: string, profileId: string) {
  const [profile] = await db
    .select()
    .from(careProfiles)
    .where(eq(careProfiles.id, profileId))
    .limit(1)

  if (!profile) return null

  // Check if user owns the profile
  if (profile.user_id === userId) {
    return { profile, role: 'owner' as const }
  }

  // Check if profile is shared with user
  const [share] = await db
    .select()
    .from(profileShares)
    .where(and(eq(profileShares.profile_id, profileId), eq(profileShares.user_id, userId)))
    .limit(1)

  if (share) {
    return { profile, role: share.role }
  }

  return null
}

/** Check if user can edit a profile (owner or shared with admin role) */
async function canEditProfile(userId: string, profileId: string) {
  const access = await canViewProfile(userId, profileId)
  if (!access) return null
  if (access.role === 'owner' || access.role === 'admin') return access
  return null
}

/** Check if user owns the profile (only owner can delete) */
async function isProfileOwner(userId: string, profileId: string) {
  const [profile] = await db
    .select()
    .from(careProfiles)
    .where(and(eq(careProfiles.id, profileId), eq(careProfiles.user_id, userId)))
    .limit(1)

  return profile ?? null
}

// POST /api/profiles
profilesRouter.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, date_of_birth, relationship, conditions, avatar_url } = req.body as {
      name?: string
      date_of_birth?: string
      relationship?: string
      conditions?: string[]
      avatar_url?: string | null
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'name is required' })
      return
    }

    const [profile] = await db
      .insert(careProfiles)
      .values({
        user_id: req.user!.userId,
        name: name.trim(),
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

    // Get profiles user owns
    const ownedProfiles = await db
      .select()
      .from(careProfiles)
      .where(eq(careProfiles.user_id, userId))

    // Get profiles shared with user
    const sharedRows = await db
      .select({ profile: careProfiles })
      .from(profileShares)
      .innerJoin(careProfiles, eq(profileShares.profile_id, careProfiles.id))
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
profilesRouter.patch('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
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
