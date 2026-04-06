/** Auth middleware — JWT verification and signing. */
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

export interface JwtPayload {
  userId: string
  email: string
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

/**
 * Express middleware that verifies the JWT cookie.
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {NextFunction} next - Express next function
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const token = req.cookies?.token as string | undefined
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload
    req.user = payload
    next()
  } catch {
    res.status(401).json({ error: 'Unauthorized' })
  }
}

/**
 * Signs a JWT payload.
 * @param {JwtPayload} payload - User identity payload
 * @returns {string} Signed JWT token
 */
export const signToken = (payload: JwtPayload): string => jwt.sign(payload, env.JWT_SECRET)
