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
import { uploadRouter } from './routes/upload'
import healthRouter from './routes/health'
import { logger } from './services/logger'

const UPLOADS_PATH = process.env.UPLOADS_PATH ?? path.join(process.cwd(), 'uploads')

export function createApp() {
  const app = express()

  // Request logging middleware (skip health checks to reduce noise)
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => req.url === '/health' || req.url === '/api/health',
      },
    })
  )

  app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173', credentials: true }))
  app.use(express.json())
  app.use(cookieParser())

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

  return app
}
