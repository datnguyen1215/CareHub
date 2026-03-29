import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import { authRouter } from './routes/auth'
import { usersRouter } from './routes/users'
import { groupsRouter } from './routes/groups'
import { profilesRouter } from './routes/profiles'
import { medicationsRouter } from './routes/medications'
import healthRouter from './routes/health'

export function createApp() {
  const app = express()

  app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173', credentials: true }))
  app.use(express.json())
  app.use(cookieParser())

  app.use('/health', healthRouter)
  app.use('/api/health', healthRouter)
  app.use('/api/auth', authRouter)
  app.use('/api/users', usersRouter)
  app.use('/api/groups', groupsRouter)
  app.use('/api/groups/:groupId/profiles', profilesRouter)
  app.use('/api/groups/:groupId/profiles/:profileId/medications', medicationsRouter)

  return app
}
