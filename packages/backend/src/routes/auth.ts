import { Router } from 'express'

const router = Router()

/**
 * POST /auth/send-otp
 * Accepts an email address and sends a one-time password via Gmail SMTP.
 * TODO (Phase 1): generate + store OTP, send email via Nodemailer
 */
router.post('/send-otp', async (req, res) => {
  const { email } = req.body as { email?: string }

  if (!email) {
    res.status(400).json({ error: 'email is required' })
    return
  }

  // TODO: generate OTP, store in DB with expiry, send via mailer
  res.json({ message: 'OTP sent (stub)' })
})

/**
 * POST /auth/verify-otp
 * Accepts an email + OTP code and verifies it, returning a session token.
 * TODO (Phase 1): verify OTP against DB, create session
 */
router.post('/verify-otp', async (req, res) => {
  const { email, code } = req.body as { email?: string; code?: string }

  if (!email || !code) {
    res.status(400).json({ error: 'email and code are required' })
    return
  }

  // TODO: verify OTP, create and return session token
  res.json({ message: 'OTP verified (stub)', token: null })
})

export default router
