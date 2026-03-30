/** Journal routes — CRUD for journal entries within a care profile. */
import { Router, Request, Response } from 'express'
import { eq, and, desc, asc, sql } from 'drizzle-orm'
import { db } from '../db'
import { journalEntries, groupMembers, careProfiles, events } from '@carehub/shared'
import { requireAuth } from '../middleware/auth'
import { logger } from '../services/logger'

export const journalRouter = Router({ mergeParams: true })

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

// POST /api/groups/:groupId/profiles/:profileId/journal
journalRouter.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const groupId = req.params['groupId'] as string
    const profileId = req.params['profileId'] as string
    const { title, content, key_takeaways, entry_date, linked_event_id, starred } = req.body as {
      title?: string
      content?: string
      key_takeaways?: string
      entry_date?: string
      linked_event_id?: string | null
      starred?: boolean
    }

    if (!title || typeof title !== 'string' || !title.trim()) {
      res.status(400).json({ error: 'title is required' })
      return
    }

    if (!content || typeof content !== 'string' || !content.trim()) {
      res.status(400).json({ error: 'content is required' })
      return
    }

    if (!entry_date || isNaN(Date.parse(entry_date))) {
      res.status(400).json({ error: 'valid entry_date is required' })
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

    // Validate linked_event_id if provided
    if (linked_event_id) {
      const [event] = await db
        .select()
        .from(events)
        .where(and(eq(events.id, linked_event_id), eq(events.care_profile_id, profileId)))
        .limit(1)

      if (!event) {
        res.status(400).json({ error: 'Invalid linked_event_id' })
        return
      }
    }

    const [entry] = await db
      .insert(journalEntries)
      .values({
        care_profile_id: profileId,
        title: title.trim(),
        content: content.trim(),
        key_takeaways: key_takeaways?.trim() || null,
        entry_date: entry_date,
        linked_event_id: linked_event_id || null,
        starred: starred ?? false,
      })
      .returning()

    res.status(201).json(entry)
  } catch (err) {
    logger.error({ err }, 'POST journal error')
    res.status(500).json({ error: 'Failed to create journal entry' })
  }
})

// GET /api/groups/:groupId/profiles/:profileId/journal/by-event/:eventId
// Get journal entries linked to a specific event
// NOTE: Must be registered before /:id to avoid matching "by-event" as an id
journalRouter.get(
  '/by-event/:eventId',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const groupId = req.params['groupId'] as string
      const profileId = req.params['profileId'] as string
      const eventId = req.params['eventId'] as string

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

      const rows = await db
        .select()
        .from(journalEntries)
        .where(
          and(
            eq(journalEntries.care_profile_id, profileId),
            eq(journalEntries.linked_event_id, eventId)
          )
        )
        .orderBy(desc(journalEntries.entry_date))

      res.json(rows)
    } catch (err) {
      logger.error({ err }, 'GET journal by event error')
      res.status(500).json({ error: 'Failed to fetch journal entries' })
    }
  }
)

// GET /api/groups/:groupId/profiles/:profileId/journal
journalRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const groupId = req.params['groupId'] as string
    const profileId = req.params['profileId'] as string
    const search = req.query['search'] as string | undefined
    const sort = req.query['sort'] as string | undefined

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

    // Determine sort order
    const orderBy =
      sort === 'oldest' ? asc(journalEntries.entry_date) : desc(journalEntries.entry_date)

    let rows
    if (search && search.trim()) {
      // Full-text search using PostgreSQL to_tsvector and plainto_tsquery
      const searchQuery = search.trim()
      rows = await db
        .select()
        .from(journalEntries)
        .where(
          and(
            eq(journalEntries.care_profile_id, profileId),
            sql`(
              to_tsvector('english', ${journalEntries.title}) ||
              to_tsvector('english', ${journalEntries.content}) ||
              to_tsvector('english', coalesce(${journalEntries.key_takeaways}, ''))
            ) @@ plainto_tsquery('english', ${searchQuery})`
          )
        )
        .orderBy(orderBy)
    } else {
      rows = await db
        .select()
        .from(journalEntries)
        .where(eq(journalEntries.care_profile_id, profileId))
        .orderBy(orderBy)
    }

    res.json(rows)
  } catch (err) {
    logger.error({ err }, 'GET journal error')
    res.status(500).json({ error: 'Failed to fetch journal entries' })
  }
})

// GET /api/groups/:groupId/profiles/:profileId/journal/:id
journalRouter.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
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

    const [entry] = await db
      .select()
      .from(journalEntries)
      .where(and(eq(journalEntries.id, id), eq(journalEntries.care_profile_id, profileId)))
      .limit(1)

    if (!entry) {
      res.status(404).json({ error: 'Journal entry not found' })
      return
    }

    res.json(entry)
  } catch (err) {
    logger.error({ err }, 'GET journal entry error')
    res.status(500).json({ error: 'Failed to fetch journal entry' })
  }
})

// PATCH /api/groups/:groupId/profiles/:profileId/journal/:id
journalRouter.patch('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const groupId = req.params['groupId'] as string
    const profileId = req.params['profileId'] as string
    const id = req.params['id'] as string
    const { title, content, key_takeaways, entry_date, linked_event_id, starred } = req.body as {
      title?: string
      content?: string
      key_takeaways?: string | null
      entry_date?: string
      linked_event_id?: string | null
      starred?: boolean
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
      content: string
      key_takeaways: string | null
      entry_date: string
      linked_event_id: string | null
      starred: boolean
      updated_at: Date
    }> = { updated_at: new Date() }

    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        res.status(400).json({ error: 'title cannot be empty' })
        return
      }
      updates.title = title.trim()
    }
    if (content !== undefined) {
      if (typeof content !== 'string' || !content.trim()) {
        res.status(400).json({ error: 'content cannot be empty' })
        return
      }
      updates.content = content.trim()
    }
    if (key_takeaways !== undefined) {
      updates.key_takeaways = key_takeaways?.trim() || null
    }
    if (entry_date !== undefined) {
      if (isNaN(Date.parse(entry_date))) {
        res.status(400).json({ error: 'invalid entry_date' })
        return
      }
      updates.entry_date = entry_date
    }
    if (linked_event_id !== undefined) {
      if (linked_event_id) {
        // Validate that the event exists and belongs to this profile
        const [event] = await db
          .select()
          .from(events)
          .where(and(eq(events.id, linked_event_id), eq(events.care_profile_id, profileId)))
          .limit(1)

        if (!event) {
          res.status(400).json({ error: 'Invalid linked_event_id' })
          return
        }
      }
      updates.linked_event_id = linked_event_id || null
    }
    if (starred !== undefined) {
      updates.starred = starred
    }

    const [updated] = await db
      .update(journalEntries)
      .set(updates)
      .where(and(eq(journalEntries.id, id), eq(journalEntries.care_profile_id, profileId)))
      .returning()

    if (!updated) {
      res.status(404).json({ error: 'Journal entry not found' })
      return
    }

    res.json(updated)
  } catch (err) {
    logger.error({ err }, 'PATCH journal error')
    res.status(500).json({ error: 'Failed to update journal entry' })
  }
})

// DELETE /api/groups/:groupId/profiles/:profileId/journal/:id
journalRouter.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
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
      .delete(journalEntries)
      .where(and(eq(journalEntries.id, id), eq(journalEntries.care_profile_id, profileId)))
      .returning()

    if (!deleted) {
      res.status(404).json({ error: 'Journal entry not found' })
      return
    }

    res.status(204).send()
  } catch (err) {
    logger.error({ err }, 'DELETE journal error')
    res.status(500).json({ error: 'Failed to delete journal entry' })
  }
})
