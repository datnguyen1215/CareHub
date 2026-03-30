/** File upload routes — handles avatar and other image uploads. */
import { Router, Request, Response, NextFunction } from 'express'
import multer, { MulterError } from 'multer'
import { requireAuth } from '../middleware/auth'
import { getStorageService } from '../services/storage'
import { logger } from '../services/logger'

export const uploadRouter = Router()

// Configure multer for memory storage (we'll pass buffer to storage service)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'))
    }
  },
})

// POST /api/upload
// Use callback-style multer invocation to properly catch multer errors
uploadRouter.post('/', requireAuth, (req: Request, res: Response, next: NextFunction): void => {
  upload.single('file')(req, res, async (err: unknown) => {
    // Handle multer errors (file size, file type, etc.)
    if (err) {
      if (err instanceof MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({ error: 'File too large. Maximum size is 5MB.' })
          return
        }
        res.status(400).json({ error: err.message })
        return
      }
      // Handle custom errors from fileFilter
      const filterErr = err as Error
      if (filterErr.message?.includes('Invalid file type')) {
        res.status(400).json({ error: filterErr.message })
        return
      }
      logger.error({ err }, 'POST /upload multer error')
      res.status(500).json({ error: 'Failed to process file upload' })
      return
    }

    // Handle missing file
    if (!req.file) {
      res.status(400).json({ error: 'No file provided' })
      return
    }

    // Upload to storage service
    try {
      const storage = getStorageService()
      const url = await storage.upload(req.file.buffer, req.file.originalname, req.file.mimetype)
      res.json({ url })
    } catch (uploadErr: unknown) {
      logger.error({ err: uploadErr }, 'POST /upload storage error')
      res.status(500).json({ error: 'Failed to upload file' })
    }
  })
})
