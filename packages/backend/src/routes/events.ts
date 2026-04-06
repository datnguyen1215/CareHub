/** Event routes — CRUD for events within a care profile. */
import { Router, Request, Response } from 'express'
import { eq, and, gte, lte } from 'drizzle-orm'
import { db } from '../db/index.js'
import { events } from '@carehub/shared'
import { requireAuth } from '../middleware/auth.js'
import { logger } from '../services/logger.js'
import { validate } from '../middleware/validate.js'
import { createEventSchema, updateEventSchema } from '../schemas/events.js'
import { canAccessProfile } from '../services/access.js'

export const eventsRouter = Router({ mergeParams: true })

// POST /api/profiles/:profileId/events
eventsRouter.post('/', requireAuth, validate(createEventSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const profileId = req.params['profileId'] as string
    const { title, event_type, event_date, location, notes } = req.body as {
      title: string
      event_type: string
      event_date: string
      location?: string | null
      notes?: string | null
    }

    const profile = await canAccessProfile(req.user!.userId, profileId)
    if (!profile) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }

    const [event] = await db
      .insert(events)
      .values({
        care_profile_id: profileId,
        title,
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

// GET /api/profiles/:profileId/events
eventsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const profileId = req.params['profileId'] as string
    const start = req.query['start'] as string | undefined
    const end = req.query['end'] as string | undefined

    const profile = await canAccessProfile(req.user!.userId, profileId)
    if (!profile) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }

    // Validate date parameters
    if (start && isNaN(Date.parse(start))) {
      res.status(400).json({ error: 'invalid start date' })
      return
    }
    if (end && isNaN(Date.parse(end))) {
      res.status(400).json({ error: 'invalid end date' })
      return
    }

    // Apply date range filters if provided
    const conditions = [eq(events.care_profile_id, profileId)]
    if (start) {
      conditions.push(gte(events.event_date, new Date(start)))
    }
    if (end) {
      conditions.push(lte(events.event_date, new Date(end)))
    }

    const rows = await db
      .select()
      .from(events)
      .where(and(...conditions))

    res.json(rows)
  } catch (err) {
    logger.error({ err }, 'GET events error')
    res.status(500).json({ error: 'Failed to fetch events' })
  }
})

// GET /api/profiles/:profileId/events/:id
eventsRouter.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const profileId = req.params['profileId'] as string
    const id = req.params['id'] as string

    const profile = await canAccessProfile(req.user!.userId, profileId)
    if (!profile) {
      res.status(403).json({ error: 'Forbidden' })
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

// PATCH /api/profiles/:profileId/events/:id
eventsRouter.patch('/:id', requireAuth, validate(updateEventSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const profileId = req.params['profileId'] as string
    const id = req.params['id'] as string
    const { title, event_type, event_date, location, notes } = req.body as {
      title?: string
      event_type?: string
      event_date?: string
      location?: string | null
      notes?: string | null
    }

    const profile = await canAccessProfile(req.user!.userId, profileId)
    if (!profile) {
      res.status(403).json({ error: 'Forbidden' })
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

    if (title !== undefined) updates.title = title
    if (event_type !== undefined) updates.event_type = event_type as 'doctor_visit' | 'lab_work' | 'therapy' | 'general'
    if (event_date !== undefined) updates.event_date = new Date(event_date)
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

// DELETE /api/profiles/:profileId/events/:id
eventsRouter.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const profileId = req.params['profileId'] as string
    const id = req.params['id'] as string

    const profile = await canAccessProfile(req.user!.userId, profileId)
    if (!profile) {
      res.status(403).json({ error: 'Forbidden' })
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
