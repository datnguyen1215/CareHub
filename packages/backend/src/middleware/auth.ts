import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

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

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.token as string | undefined
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const secret = process.env.JWT_SECRET ?? 'carehub-dev-secret'
    const payload = jwt.verify(token, secret) as JwtPayload
    req.user = payload
    next()
  } catch {
    res.status(401).json({ error: 'Unauthorized' })
  }
}

export function signToken(payload: JwtPayload): string {
  const secret = process.env.JWT_SECRET ?? 'carehub-dev-secret'
  return jwt.sign(payload, secret)
}
