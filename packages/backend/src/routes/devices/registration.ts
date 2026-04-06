/** Device registration — unauthenticated kiosk first-launch. */
import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { devices } from '@carehub/shared'
import { deviceRegisterLimiter } from '../../middleware/rateLimit.js'
import { logger } from '../../services/logger.js'

export const registrationRouter = Router()

/** Generate cryptographically secure token */
const generateToken = (): string => crypto.randomBytes(32).toString('hex')

/**
 * POST /api/devices/register
 * Register a new device and get a device token.
 * Called by kiosk on first launch.
 */
registrationRouter.post('/register', deviceRegisterLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const deviceToken = generateToken()
    const name = `Kiosk-${Date.now().toString(36).toUpperCase()}`

    const [device] = await db
      .insert(devices)
      .values({
        device_token: deviceToken,
        name,
        status: 'offline',
      })
      .returning()

    res.status(201).json({
      deviceId: device.id,
      deviceToken: device.device_token,
      name: device.name,
    })
  } catch (err) {
    logger.error({ err }, 'POST /devices/register error')
    res.status(500).json({ error: 'Failed to register device' })
  }
})
