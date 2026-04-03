import express from 'express'
import path from 'path'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import pinoHttp from 'pino-http'
import { authRouter } from './routes/auth'
import { usersRouter } from './routes/users'
import { profilesRouter } from './routes/profiles'
import { medicationsRouter } from './routes/medications'
import { eventsRouter } from './routes/events'
import { journalRouter } from './routes/journal'
import { attachmentsRouter } from './routes/attachments'
import { uploadRouter } from './routes/upload'
import { devicesRouter } from './routes/devices'
import healthRouter from './routes/health'
import { logger } from './services/logger'
import { errorHandler } from './middleware/errorHandler'
import { globalLimiter } from './middleware/rateLimit'

const UPLOADS_PATH = process.env.UPLOADS_PATH ?? path.join(process.cwd(), 'uploads')

export function createApp() {
  const app = express()
  app.set('trust proxy', 1)

  // Request logging middleware (skip health checks to reduce noise)
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => req.url === '/health' || req.url === '/api/health',
      },
    })
  )

  // Allow multiple origins for portal and kiosk apps
  const allowedOrigins = [
    process.env.FRONTEND_URL ?? 'http://localhost:9390',
    process.env.KIOSK_URL ?? 'http://localhost:9393',
  ]
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true)
        if (allowedOrigins.includes(origin)) return callback(null, true)
        callback(null, false)
      },
      credentials: true,
    })
  )
  app.use(express.json())
  app.use(cookieParser())

  // Global rate limit for all API routes
  app.use('/api', globalLimiter)

  // Serve uploaded files statically
  app.use('/uploads', express.static(UPLOADS_PATH))

  app.use('/health', healthRouter)
  app.use('/api/health', healthRouter)
  app.use('/api/auth', authRouter)
  app.use('/api/users', usersRouter)
  app.use('/api/upload', uploadRouter)
  app.use('/api/profiles', profilesRouter)
  app.use('/api/profiles/:profileId/medications', medicationsRouter)
  app.use('/api/profiles/:profileId/events', eventsRouter)
  app.use('/api/profiles/:profileId/journal', journalRouter)
  app.use('/api/profiles/:profileId/attachments', attachmentsRouter)
  app.use('/api/devices', devicesRouter)

  // Global error handler — must be registered after all routes
  app.use(errorHandler)

  return app
}
