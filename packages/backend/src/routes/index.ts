import { Express } from 'express'
import { authRouter } from './auth.js'
import { usersRouter } from './users.js'
import { profilesRouter } from './profiles.js'
import { medicationsRouter } from './medications.js'
import { eventsRouter } from './events.js'
import { journalRouter } from './journal.js'
import { attachmentsRouter } from './attachments.js'
import { uploadRouter } from './upload.js'
import { devicesRouter } from './devices/index.js'
import { releasesRouter } from './releases/index.js'
import healthRouter from './health.js'

export function registerRoutes(app: Express): void {
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
  app.use('/api/releases', releasesRouter)
}
