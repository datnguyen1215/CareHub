import cors from 'cors'
import express, { type Application } from 'express'

/**
 * Registers shared middleware on the Express application:
 * - CORS with permissive defaults (tighten in production)
 * - JSON body parsing
 * - URL-encoded body parsing
 */
export function applyMiddleware(app: Application): void {
  app.use(
    cors({
      // credentials: true requires a specific origin in production — '*' is
      // intentionally permissive for local development only.
      origin: process.env.CORS_ORIGIN ?? '*',
      credentials: true,
    })
  )
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))
}
