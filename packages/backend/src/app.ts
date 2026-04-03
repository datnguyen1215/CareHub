/**
 * CareHub API application factory.
 *
 * ## API Response Contract
 *
 * All routes MUST follow these response format conventions:
 *
 * - **Success with data**: Return entity/array directly with 200 or 201 status.
 * - **Success without data** (e.g. DELETE, logout): Return 204 No Content.
 * - **Error**: Return `{ error: 'description' }` with appropriate HTTP status code.
 * - **Health check**: `{ status: 'ok' }` is the exception (standard health-check convention).
 */
import express from 'express'
import path from 'path'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import pinoHttp from 'pino-http'
import { registerRoutes } from './routes'
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

  registerRoutes(app)

  // Global error handler — must be registered after all routes
  app.use(errorHandler)

  return app
}
