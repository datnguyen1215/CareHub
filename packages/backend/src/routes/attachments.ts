/** Attachment routes — CRUD for file attachments linked to events or journal entries. */
import { Router, Request, Response, NextFunction } from 'express'
import multer, { MulterError } from 'multer'
import { eq, and, desc, or, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { attachments, events, journalEntries } from '@carehub/shared'
import { requireAuth } from '../middleware/auth.js'
import { getStorageService } from '../services/storage/index.js'
import { logger } from '../services/logger.js'
import { queueAttachmentProcessing } from '../services/attachment-processor.js'
import { validate } from '../middleware/validate.js'
import { createAttachmentSchema, updateAttachmentSchema, VALID_CATEGORIES } from '../schemas/attachments.js'
import { validateQuery } from '../middleware/validate.js'
import { paginationSchema } from '../schemas/query.js'
import { canAccessProfile } from '../services/access.js'

export const attachmentsRouter = Router({ mergeParams: true })

type AttachmentCategory = (typeof VALID_CATEGORIES)[number]

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB for attachments (larger than avatars)
  },
  fileFilter: (_req, file, cb) => {
    // Allow images, PDFs, and common document types
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Allowed: JPEG, PNG, GIF, WebP, PDF, DOC, DOCX.'))
    }
  },
})

// POST /api/profiles/:profileId/attachments
// Upload file and create attachment record
attachmentsRouter.post(
  '/',
  requireAuth,
  (req: Request, res: Response, _next: NextFunction): void => {
    upload.single('file')(req, res, async (err: unknown) => {
      // Handle multer errors
      if (err) {
        if (err instanceof MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            res.status(400).json({ error: 'File too large. Maximum size is 10MB.' })
            return
          }
          res.status(400).json({ error: err.message })
          return
        }
        const filterErr = err as Error
        if (filterErr.message?.includes('Invalid file type')) {
          res.status(400).json({ error: filterErr.message })
          return
        }
        logger.error({ err }, 'POST attachments multer error')
        res.status(500).json({ error: 'Failed to process file upload' })
        return
      }

      // Handle missing file
      if (!req.file) {
        res.status(400).json({ error: 'No file provided' })
        return
      }

      // Validate body fields
      const bodyResult = createAttachmentSchema.safeParse(req.body)
      if (!bodyResult.success) {
        res.status(400).json({ error: bodyResult.error.issues[0].message })
        return
      }
      req.body = bodyResult.data

      try {
        const profileId = req.params['profileId'] as string
        const { event_id, journal_id, category, description } = bodyResult.data

        // Check profile access
        const profile = await canAccessProfile(req.user!.userId, profileId)
        if (!profile) {
          res.status(403).json({ error: 'Forbidden' })
          return
        }

        // Validate event_id if provided
        if (event_id) {
          const [event] = await db
            .select()
            .from(events)
            .where(and(eq(events.id, event_id), eq(events.care_profile_id, profileId)))
            .limit(1)

          if (!event) {
            res.status(400).json({ error: 'Invalid event_id' })
            return
          }
        }

        // Validate journal_id if provided
        if (journal_id) {
          const [journal] = await db
            .select()
            .from(journalEntries)
            .where(
              and(eq(journalEntries.id, journal_id), eq(journalEntries.care_profile_id, profileId))
            )
            .limit(1)

          if (!journal) {
            res.status(400).json({ error: 'Invalid journal_id' })
            return
          }
        }

        // Upload file to storage
        const storage = getStorageService()
        const fileUrl = await storage.upload(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype
        )

        // Create attachment record
        const [attachment] = await db
          .insert(attachments)
          .values({
            profile_id: profileId,
            event_id: event_id || null,
            journal_id: journal_id || null,
            file_url: fileUrl,
            description: description?.trim() || null,
            category,
          })
          .returning()

        // Queue OCR and AI processing in background — doesn't block response
        queueAttachmentProcessing(attachment.id)

        res.status(201).json(attachment)
      } catch (uploadErr: unknown) {
        logger.error({ err: uploadErr }, 'POST attachments error')
        res.status(500).json({ error: 'Failed to create attachment' })
      }
    })
  }
)

// GET /api/profiles/:profileId/attachments
// List attachments with optional filters and search
attachmentsRouter.get('/', requireAuth, validateQuery(paginationSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const profileId = req.params['profileId'] as string
    const eventId = req.query['event_id'] as string | undefined
    const journalId = req.query['journal_id'] as string | undefined
    const category = req.query['category'] as string | undefined
    const limit = req.query['limit'] as number | undefined
    const offset = req.query['offset'] as number | undefined
    const search = req.query['search'] as string | undefined

    const profile = await canAccessProfile(req.user!.userId, profileId)
    if (!profile) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }

    // Build query conditions
    const conditions = [eq(attachments.profile_id, profileId)]

    if (eventId) {
      conditions.push(eq(attachments.event_id, eventId))
    }

    if (journalId) {
      conditions.push(eq(attachments.journal_id, journalId))
    }

    if (category && VALID_CATEGORIES.includes(category as AttachmentCategory)) {
      conditions.push(eq(attachments.category, category as AttachmentCategory))
    }

    // Add search filter for description and ocr_text
    if (search && search.trim()) {
      const searchQuery = search.trim()
      conditions.push(
        or(
          sql`to_tsvector('english', coalesce(${attachments.description}, '')) @@ plainto_tsquery('english', ${searchQuery})`,
          sql`to_tsvector('english', coalesce(${attachments.ocr_text}, '')) @@ plainto_tsquery('english', ${searchQuery})`
        )!
      )
    }

    let query = db
      .select()
      .from(attachments)
      .where(and(...conditions))
      .orderBy(desc(attachments.created_at))

    if (limit) {
      query = query.limit(limit) as typeof query
    }

    if (offset) {
      query = query.offset(offset) as typeof query
    }

    const rows = await query

    res.json(rows)
  } catch (err) {
    logger.error({ err }, 'GET attachments error')
    res.status(500).json({ error: 'Failed to fetch attachments' })
  }
})

// GET /api/profiles/:profileId/attachments/:id
// Get single attachment
attachmentsRouter.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const profileId = req.params['profileId'] as string
    const id = req.params['id'] as string

    const profile = await canAccessProfile(req.user!.userId, profileId)
    if (!profile) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }

    const [attachment] = await db
      .select()
      .from(attachments)
      .where(and(eq(attachments.id, id), eq(attachments.profile_id, profileId)))
      .limit(1)

    if (!attachment) {
      res.status(404).json({ error: 'Attachment not found' })
      return
    }

    res.json(attachment)
  } catch (err) {
    logger.error({ err }, 'GET attachment error')
    res.status(500).json({ error: 'Failed to fetch attachment' })
  }
})

// PATCH /api/profiles/:profileId/attachments/:id
// Update attachment metadata (description, category)
attachmentsRouter.patch('/:id', requireAuth, validate(updateAttachmentSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const profileId = req.params['profileId'] as string
    const id = req.params['id'] as string
    const { description, category } = req.body as {
      description?: string | null
      category?: string
    }

    const profile = await canAccessProfile(req.user!.userId, profileId)
    if (!profile) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }

    const updates: Partial<{
      description: string | null
      category: AttachmentCategory
      updated_at: Date
    }> = { updated_at: new Date() }

    if (description !== undefined) {
      updates.description = description?.trim() || null
    }

    if (category !== undefined) {
      updates.category = category as AttachmentCategory
    }

    const [updated] = await db
      .update(attachments)
      .set(updates)
      .where(and(eq(attachments.id, id), eq(attachments.profile_id, profileId)))
      .returning()

    if (!updated) {
      res.status(404).json({ error: 'Attachment not found' })
      return
    }

    res.json(updated)
  } catch (err) {
    logger.error({ err }, 'PATCH attachment error')
    res.status(500).json({ error: 'Failed to update attachment' })
  }
})

// DELETE /api/profiles/:profileId/attachments/:id
// Delete attachment and its file
attachmentsRouter.delete(
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

      // Get attachment to find file URL
      const [attachment] = await db
        .select()
        .from(attachments)
        .where(and(eq(attachments.id, id), eq(attachments.profile_id, profileId)))
        .limit(1)

      if (!attachment) {
        res.status(404).json({ error: 'Attachment not found' })
        return
      }

      // Delete from database
      await db
        .delete(attachments)
        .where(and(eq(attachments.id, id), eq(attachments.profile_id, profileId)))

      // Delete file from storage
      try {
        const storage = getStorageService()
        await storage.delete(attachment.file_url)
      } catch (storageErr) {
        // Log but don't fail if file deletion fails
        logger.warn({ err: storageErr, fileUrl: attachment.file_url }, 'Failed to delete file')
      }

      res.status(204).send()
    } catch (err) {
      logger.error({ err }, 'DELETE attachment error')
      res.status(500).json({ error: 'Failed to delete attachment' })
    }
  }
)
