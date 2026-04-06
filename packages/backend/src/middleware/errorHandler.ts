import { Request, Response, NextFunction } from 'express'
import { logger } from '../services/logger.js'

/**
 * Global error handler middleware. Must be registered AFTER all routes.
 * Logs the error with request context and returns a generic 500 response.
 */
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  logger.error({ err, method: req.method, url: req.url }, 'Unhandled error')
  if (res.headersSent) {
    return _next(err)
  }
  res.status(500).json({ error: 'Internal server error' })
}
