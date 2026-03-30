/** Event routes — CRUD for events within a care profile. */
import { Router, Request, Response } from 'express'
import { eq, and, gte, lte } from 'drizzle-orm'
import { db } from '../db'
import { events, groupMembers, careProfiles } from '@carehub/shared'
import { requireAuth } from '../middleware/auth'
import { logger } from '../services/logger'

export const eventsRouter = Router({ mergeParams: true })

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

const VALID_EVENT_TYPES = ['doctor_visit', 'lab_work', 'therapy', 'general']

// POST /api/groups/:groupId/profiles/:profileId/events
eventsRouter.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const groupId = req.params['groupId'] as string
    const profileId = req.params['profileId'] as string
    const { title, event_type, event_date, location, notes } = req.body as {
      title?: string
      event_type?: string
      event_date?: string
      location?: string
      notes?: string
    }

    if (!title || typeof title !== 'string' || !title.trim()) {
      res.status(400).json({ error: 'title is required' })
      return
    }

    if (!event_type || !VALID_EVENT_TYPES.includes(event_type)) {
      res.status(400).json({ error: 'valid event_type is required' })
      return
    }

    if (!event_date || isNaN(Date.parse(event_date))) {
      res.status(400).json({ error: 'valid event_date is required' })
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

    const [event] = await db
      .insert(events)
      .values({
        care_profile_id: profileId,
        title: title.trim(),
        event_type: event_type as 'doctor_visit' | 'lab_work' | 'therapy' | 'general',
        event_date: new Date(event_date),
        location: location ?? null,
        notes: notes ?? null,
      })
      .returning()

    res.status(201).json(event)
  } catch (err) {
    logger.error({ err }, 'POST events error')
    res.status(500).json({ error: 'Failed to create event' })
  }
})

// GET /api/groups/:groupId/profiles/:profileId/events
eventsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const groupId = req.params['groupId'] as string
    const profileId = req.params['profileId'] as string
    const start = req.query['start'] as string | undefined
    const end = req.query['end'] as string | undefined

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

    let query = db.select().from(events).where(eq(events.care_profile_id, profileId))

    // Apply date range filters if provided
    const conditions = [eq(events.care_profile_id, profileId)]
    if (start) {
      conditions.push(gte(events.event_date, new Date(start)))
    }
    if (end) {
      conditions.push(lte(events.event_date, new Date(end)))
    }

    const rows = await db.select().from(events).where(and(...conditions))

    res.json(rows)
  } catch (err) {
    logger.error({ err }, 'GET events error')
    res.status(500).json({ error: 'Failed to fetch events' })
  }
})

// GET /api/groups/:groupId/profiles/:profileId/events/:id
eventsRouter.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
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

    const [event] = await db
      .select()
      .from(events)
      .where(and(eq(events.id, id), eq(events.care_profile_id, profileId)))
      .limit(1)

    if (!event) {
      res.status(404).json({ error: 'Event not found' })
      return
    }

    res.json(event)
  } catch (err) {
    logger.error({ err }, 'GET event error')
    res.status(500).json({ error: 'Failed to fetch event' })
  }
})

// PATCH /api/groups/:groupId/profiles/:profileId/events/:id
eventsRouter.patch('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const groupId = req.params['groupId'] as string
    const profileId = req.params['profileId'] as string
    const id = req.params['id'] as string
    const { title, event_type, event_date, location, notes } = req.body as {
      title?: string
      event_type?: string
      event_date?: string
      location?: string | null
      notes?: string | null
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
      title: string
      event_type: 'doctor_visit' | 'lab_work' | 'therapy' | 'general'
      event_date: Date
      location: string | null
      notes: string | null
      updated_at: Date
    }> = { updated_at: new Date() }

    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        res.status(400).json({ error: 'title cannot be empty' })
        return
      }
      updates.title = title.trim()
    }
    if (event_type !== undefined) {
      if (!VALID_EVENT_TYPES.includes(event_type)) {
        res.status(400).json({ error: 'invalid event_type' })
        return
      }
      updates.event_type = event_type as 'doctor_visit' | 'lab_work' | 'therapy' | 'general'
    }
    if (event_date !== undefined) {
      if (isNaN(Date.parse(event_date))) {
        res.status(400).json({ error: 'invalid event_date' })
        return
      }
      updates.event_date = new Date(event_date)
    }
    if (location !== undefined) updates.location = location
    if (notes !== undefined) updates.notes = notes

    const [updated] = await db
      .update(events)
      .set(updates)
      .where(and(eq(events.id, id), eq(events.care_profile_id, profileId)))
      .returning()

    if (!updated) {
      res.status(404).json({ error: 'Event not found' })
      return
    }

    res.json(updated)
  } catch (err) {
    logger.error({ err }, 'PATCH events error')
    res.status(500).json({ error: 'Failed to update event' })
  }
})

// DELETE /api/groups/:groupId/profiles/:profileId/events/:id
eventsRouter.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
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
      .delete(events)
      .where(and(eq(events.id, id), eq(events.care_profile_id, profileId)))
      .returning()

    if (!deleted) {
      res.status(404).json({ error: 'Event not found' })
      return
    }

    res.status(204).send()
  } catch (err) {
    logger.error({ err }, 'DELETE events error')
    res.status(500).json({ error: 'Failed to delete event' })
  }
})
