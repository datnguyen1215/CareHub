/** Device (kiosk) endpoints — use device token auth. */
import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { devices, deviceCareProfiles, deviceAccess, devicePairingTokens, careProfiles, users } from '@carehub/shared'
import { requireDeviceAuth } from '../../middleware/deviceAuth'
import { logger } from '../../services/logger'

export const kioskRouter = Router()

/** Generate short pairing token for QR code (8 chars) */
const generatePairingToken = (): string => crypto.randomBytes(4).toString('hex').toUpperCase()

/**
 * GET /api/devices/me
 * Validate device token and return device info with assigned profiles.
 * Called by kiosk to validate token and get current state.
 */
kioskRouter.get('/me', requireDeviceAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const deviceId = req.device!.deviceId

    // Get device with assigned profiles
    const [device] = await db.select().from(devices).where(eq(devices.id, deviceId)).limit(1)

    if (!device) {
      res.status(404).json({ error: 'Device not found' })
      return
    }

    // Get assigned profiles
    const assignedProfiles = await db
      .select({
        id: careProfiles.id,
        name: careProfiles.name,
        avatar_url: careProfiles.avatar_url,
        date_of_birth: careProfiles.date_of_birth,
      })
      .from(deviceCareProfiles)
      .innerJoin(careProfiles, eq(deviceCareProfiles.care_profile_id, careProfiles.id))
      .where(eq(deviceCareProfiles.device_id, deviceId))

    // Get caretakers who have access to this device
    const caretakers = await db
      .select({
        id: users.id,
        email: users.email,
        first_name: users.first_name,
        last_name: users.last_name,
        avatar_url: users.avatar_url,
      })
      .from(deviceAccess)
      .innerJoin(users, eq(deviceAccess.user_id, users.id))
      .where(eq(deviceAccess.device_id, deviceId))

    res.json({
      id: device.id,
      name: device.name,
      status: device.status,
      pairedAt: device.paired_at,
      profiles: assignedProfiles,
      caretakers,
    })
  } catch (err) {
    logger.error({ err }, 'GET /devices/me error')
    res.status(500).json({ error: 'Failed to fetch device info' })
  }
})

/**
 * POST /api/devices/pairing-token
 * Generate a pairing token (QR code content) for the device.
 * Caretaker scans this QR to link device to their profiles.
 */
kioskRouter.post(
  '/pairing-token',
  requireDeviceAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const deviceId = req.device!.deviceId

      // Delete any existing unexpired tokens for this device
      await db.delete(devicePairingTokens).where(eq(devicePairingTokens.device_id, deviceId))

      // Create new token with 5-minute expiry
      const token = generatePairingToken()
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

      await db.insert(devicePairingTokens).values({
        token,
        device_id: deviceId,
        expires_at: expiresAt,
      })

      res.status(201).json({
        token,
        expiresAt: expiresAt.toISOString(),
      })
    } catch (err) {
      logger.error({ err }, 'POST /devices/pairing-token error')
      res.status(500).json({ error: 'Failed to generate pairing token' })
    }
  }
)

/**
 * GET /api/devices/pairing-status
 * Check if device has been paired (poll endpoint).
 * Returns paired=true once a caretaker scans the QR.
 */
kioskRouter.get(
  '/pairing-status',
  requireDeviceAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const deviceId = req.device!.deviceId

      const [device] = await db
        .select({ paired_at: devices.paired_at })
        .from(devices)
        .where(eq(devices.id, deviceId))
        .limit(1)

      if (!device) {
        res.status(404).json({ error: 'Device not found' })
        return
      }

      res.json({
        paired: device.paired_at !== null,
        pairedAt: device.paired_at,
      })
    } catch (err) {
      logger.error({ err }, 'GET /devices/pairing-status error')
      res.status(500).json({ error: 'Failed to check pairing status' })
    }
  }
)
