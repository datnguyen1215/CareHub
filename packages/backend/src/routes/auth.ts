import { Router, Request, Response } from 'express'
import { eq, and, gt } from 'drizzle-orm'
import { db } from '../db'
import { otps, users } from '@carehub/shared'
import { sendOtpEmail } from '../services/email'
import { signToken } from '../middleware/auth'

export const authRouter = Router()

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// POST /api/auth/request-otp
authRouter.post('/request-otp', async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body as { email?: string }
  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'email is required' })
    return
  }

  const code = generateOtp()
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

  await db.insert(otps).values({ email, code, expires_at: expiresAt })
  await sendOtpEmail(email, code)

  res.json({ message: 'OTP sent' })
})

// POST /api/auth/verify-otp
authRouter.post('/verify-otp', async (req: Request, res: Response): Promise<void> => {
  const { email, code } = req.body as { email?: string; code?: string }
  if (!email || !code) {
    res.status(400).json({ error: 'email and code are required' })
    return
  }

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

  // Delete used OTP
  await db.delete(otps).where(eq(otps.id, otp.id))

  // Find or create user
  let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)

  const isNewUser = !user
  if (isNewUser) {
    const [created] = await db.insert(users).values({ email }).returning()
    user = created
  }

  const token = signToken({ userId: user.id, email: user.email })

  res
    .cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
    .json({ isNewUser })
})

// POST /api/auth/logout
authRouter.post('/logout', (_req: Request, res: Response): void => {
  res.clearCookie('token').json({ message: 'Logged out' })
})
