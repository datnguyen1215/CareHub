/** Auth routes — OTP request, verification, logout, and WebSocket tickets. */
import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { eq, and, gt, max } from 'drizzle-orm'
import { db } from '../db'
import { otps, users } from '@carehub/shared'
import { sendOtpEmail } from '../services/email'
import { signToken, requireAuth } from '../middleware/auth'
import { authLimiter } from '../middleware/rateLimit'
import { logger } from '../services/logger'
import { validate } from '../middleware/validate'
import { requestOtpSchema, verifyOtpSchema } from '../schemas/auth'
import { TIMEOUTS } from '../config/constants'

export const authRouter = Router()

/** WebSocket ticket store: ticket -> { userId, expiresAt } */
interface WsTicket {
  userId: string
  expiresAt: number
}
const wsTickets = new Map<string, WsTicket>()

/**
 * Generates a cryptographically random WebSocket ticket.
 * @returns 32-character hex ticket
 */
const generateWsTicket = (): string => crypto.randomBytes(16).toString('hex')

/**
 * Create a WebSocket ticket for a user (used by tests and the ws-ticket endpoint).
 * @param userId - The user ID to associate with the ticket
 * @returns The generated ticket string
 */
export const generateWsTicketForUser = (userId: string): string => {
  const ticket = generateWsTicket()
  wsTickets.set(ticket, {
    userId,
    expiresAt: Date.now() + TIMEOUTS.WS_TICKET_TTL_MS,
  })
  return ticket
}

/**
 * Validates and consumes a WebSocket ticket (one-time use).
 * @param ticket - The ticket to validate
 * @returns The userId if valid, null otherwise
 */
export const consumeWsTicket = (ticket: string): string | null => {
  const entry = wsTickets.get(ticket)
  if (!entry) return null

  wsTickets.delete(ticket) // One-time use

  if (Date.now() > entry.expiresAt) return null

  return entry.userId
}

/** Periodic cleanup of expired tickets (runs every 60 seconds). */
setInterval(() => {
  const now = Date.now()
  for (const [ticket, entry] of wsTickets) {
    if (now > entry.expiresAt) {
      wsTickets.delete(ticket)
    }
  }
}, TIMEOUTS.WS_TICKET_CLEANUP_INTERVAL_MS)

/**
 * Generates a cryptographically random 6-digit OTP.
 * @returns {string} 6-digit OTP string
 */
const generateOtp = (): string => crypto.randomInt(100000, 1000000).toString()

// POST /api/auth/request-otp
authRouter.post('/request-otp', authLimiter, validate(requestOtpSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body as { email: string }

    // Enforce 60-second cooldown between OTP requests for the same email
    const [{ lastSent }] = await db
      .select({ lastSent: max(otps.created_at) })
      .from(otps)
      .where(eq(otps.email, email))

    if (lastSent) {
      const secondsElapsed = (Date.now() - new Date(lastSent).getTime()) / 1000
      const retryAfter = Math.ceil(TIMEOUTS.OTP_REQUEST_COOLDOWN_S - secondsElapsed)
      if (retryAfter > 0) {
        res.status(429).json({ error: 'Please wait before requesting another OTP', retryAfter })
        return
      }
    }

    const code = generateOtp()
    const expiresAt = new Date(Date.now() + TIMEOUTS.OTP_EXPIRATION_MS)

    await sendOtpEmail(email, code)
    await db.insert(otps).values({ email, code, expires_at: expiresAt })

    res.json({ sent: true })
  } catch (err) {
    logger.error({ err }, 'request-otp error')
    res.status(500).json({ error: 'Failed to send OTP' })
  }
})

// POST /api/auth/verify-otp
authRouter.post('/verify-otp', authLimiter, validate(verifyOtpSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, code } = req.body as { email: string; code: string }

    const now = new Date()
    const [otp] = await db
      .select()
      .from(otps)
      .where(and(eq(otps.email, email), eq(otps.code, code), gt(otps.expires_at, now)))
      .limit(1)

    if (!otp) {
      res.status(401).json({ error: 'Invalid or expired OTP' })
      return
    }

    // Delete used OTP and upsert user in a transaction
    const { user, isNewUser } = await db.transaction(async (tx) => {
      await tx.delete(otps).where(eq(otps.email, email))

      let [existing] = await tx.select().from(users).where(eq(users.email, email)).limit(1)
      const isNew = !existing
      if (isNew) {
        const [created] = await tx.insert(users).values({ email }).returning()
        existing = created
      }

      return { user: existing, isNewUser: isNew }
    })

    const token = signToken({ userId: user.id, email: user.email })

    res
      .cookie('token', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      })
      .json({ isNewUser })
  } catch (err) {
    logger.error({ err }, 'verify-otp error')
    res.status(500).json({ error: 'Verification failed' })
  }
})

// POST /api/auth/logout
authRouter.post('/logout', (_req: Request, res: Response): void => {
  res.clearCookie('token').status(204).end()
})

// GET /api/auth/ws-ticket - Get a short-lived ticket for WebSocket authentication
authRouter.get('/ws-ticket', requireAuth, (req: Request, res: Response): void => {
  const ticket = generateWsTicketForUser(req.user!.userId)
  res.json({ ticket })
})
