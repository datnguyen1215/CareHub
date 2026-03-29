import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import { authRouter } from './routes/auth'
import { usersRouter } from './routes/users'
import healthRouter from './routes/health'

export function createApp() {
  const app = express()

  app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173', credentials: true }))
  app.use(express.json())
  app.use(cookieParser())

  app.use('/health', healthRouter)
  app.use('/api/auth', authRouter)
  app.use('/api/users', usersRouter)

  return app
}
