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
      origin: process.env.CORS_ORIGIN ?? '*',
      credentials: true,
    })
  )
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))
}
