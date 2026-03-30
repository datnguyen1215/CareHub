/** File upload routes — handles avatar and other image uploads. */
import { Router, Request, Response } from 'express'
import multer from 'multer'
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
uploadRouter.post(
  '/',
  requireAuth,
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file provided' })
        return
      }

      const storage = getStorageService()
      const url = await storage.upload(req.file.buffer, req.file.originalname, req.file.mimetype)

      res.json({ url })
    } catch (err: unknown) {
      const multerErr = err as { message?: string; code?: string }
      if (multerErr.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ error: 'File too large. Maximum size is 5MB.' })
        return
      }
      if (multerErr.message?.includes('Invalid file type')) {
        res.status(400).json({ error: multerErr.message })
        return
      }
      logger.error({ err }, 'POST /upload error')
      res.status(500).json({ error: 'Failed to upload file' })
    }
  }
)
