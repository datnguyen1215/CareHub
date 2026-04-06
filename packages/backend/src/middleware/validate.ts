import { type Request, type Response, type NextFunction } from 'express'
import { type ZodSchema, type ZodError } from 'zod'

/**
 * Creates Express middleware that validates req.body against a Zod schema.
 * Returns the first validation error message to match existing API behavior.
 */
export const validate = (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction): void => {
  const result = schema.safeParse(req.body)
  if (!result.success) {
    const message = formatError(result.error)
    res.status(400).json({ error: message })
    return
  }
  req.body = result.data
  next()
}

/**
 * Creates Express middleware that validates req.query against a Zod schema.
 * Returns the first validation error message to match existing API behavior.
 */
export const validateQuery = (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction): void => {
  const result = schema.safeParse(req.query)
  if (!result.success) {
    const message = formatError(result.error)
    res.status(400).json({ error: message })
    return
  }
  req.query = result.data as typeof req.query
  next()
}

function formatError(error: ZodError): string {
  const firstIssue = error.issues[0]
  if (firstIssue) {
    return firstIssue.message
  }
  return 'Validation failed'
}
