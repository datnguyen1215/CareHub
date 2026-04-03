import { Express } from 'express'
import { authRouter } from './auth'
import { usersRouter } from './users'
import { profilesRouter } from './profiles'
import { medicationsRouter } from './medications'
import { eventsRouter } from './events'
import { journalRouter } from './journal'
import { attachmentsRouter } from './attachments'
import { uploadRouter } from './upload'
import { devicesRouter } from './devices'
import healthRouter from './health'

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
}
