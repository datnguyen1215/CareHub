/** Device routes — kiosk registration and caretaker device management. */
import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { eq, and, gt, inArray } from 'drizzle-orm'
import { db } from '../db'
import {
  devices,
  deviceCareProfiles,
  deviceAccess,
  devicePairingTokens,
  careProfiles,
  users,
} from '@carehub/shared'
import { requireAuth } from '../middleware/auth'
import { requireDeviceAuth } from '../middleware/deviceAuth'
import { logger } from '../services/logger'
import { broadcastToDevice, isDeviceConnected } from '../websocket'

export const devicesRouter = Router()

/** Generate cryptographically secure token */
const generateToken = (): string => crypto.randomBytes(32).toString('hex')

/** Generate short pairing token for QR code (8 chars) */
const generatePairingToken = (): string => crypto.randomBytes(4).toString('hex').toUpperCase()

// ============================================================
// Device (Kiosk) Endpoints — use device token auth
// ============================================================

/**
 * POST /api/devices/register
 * Register a new device and get a device token.
 * Called by kiosk on first launch.
 */
devicesRouter.post('/register', async (req: Request, res: Response): Promise<void> => {
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

/**
 * GET /api/devices/me
 * Validate device token and return device info with assigned profiles.
 * Called by kiosk to validate token and get current state.
 */
devicesRouter.get('/me', requireDeviceAuth, async (req: Request, res: Response): Promise<void> => {
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
devicesRouter.post(
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
devicesRouter.get(
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

// ============================================================
// Caretaker (Portal) Endpoints — use user JWT auth
// ============================================================

/**
 * GET /api/devices
 * List devices the authenticated user has access to.
 */
devicesRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId

    // Get devices user has access to
    const userDevices = await db
      .select({
        id: devices.id,
        name: devices.name,
        status: devices.status,
        battery_level: devices.battery_level,
        last_seen_at: devices.last_seen_at,
        paired_at: devices.paired_at,
        created_at: devices.created_at,
      })
      .from(deviceAccess)
      .innerJoin(devices, eq(deviceAccess.device_id, devices.id))
      .where(eq(deviceAccess.user_id, userId))

    // Get profile counts for each device
    const result = await Promise.all(
      userDevices.map(async (device) => {
        const profiles = await db
          .select({
            id: careProfiles.id,
            name: careProfiles.name,
            avatar_url: careProfiles.avatar_url,
          })
          .from(deviceCareProfiles)
          .innerJoin(careProfiles, eq(deviceCareProfiles.care_profile_id, careProfiles.id))
          .where(eq(deviceCareProfiles.device_id, device.id))

        return {
          ...device,
          profiles,
        }
      })
    )

    res.json(result)
  } catch (err) {
    logger.error({ err }, 'GET /devices error')
    res.status(500).json({ error: 'Failed to fetch devices' })
  }
})

/**
 * POST /api/devices/pair
 * Complete pairing by scanning QR token.
 * Links device to profiles and grants caretaker access.
 */
devicesRouter.post('/pair', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId
    const { token, profileIds } = req.body as { token?: string; profileIds?: string[] }

    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'Pairing token is required' })
      return
    }

    // Find valid pairing token
    const now = new Date()
    const [pairingToken] = await db
      .select()
      .from(devicePairingTokens)
      .where(
        and(
          eq(devicePairingTokens.token, token.toUpperCase()),
          gt(devicePairingTokens.expires_at, now)
        )
      )
      .limit(1)

    if (!pairingToken || !pairingToken.device_id) {
      res.status(400).json({ error: 'Invalid or expired pairing token' })
      return
    }

    const deviceId = pairingToken.device_id

    // Verify user has access to the profiles they're assigning
    const validProfileIds: string[] = []
    if (profileIds && Array.isArray(profileIds) && profileIds.length > 0) {
      const userProfiles = await db
        .select({ id: careProfiles.id })
        .from(careProfiles)
        .where(and(eq(careProfiles.user_id, userId), inArray(careProfiles.id, profileIds)))

      validProfileIds.push(...userProfiles.map((p) => p.id))
    }

    // Check actual WebSocket connection status
    const status = isDeviceConnected(deviceId) ? 'online' : 'offline'

    await db.transaction(async (tx) => {
      // Update device as paired
      await tx
        .update(devices)
        .set({ paired_at: now, status })
        .where(eq(devices.id, deviceId))

      // Grant user access to device
      const existingAccess = await tx
        .select()
        .from(deviceAccess)
        .where(and(eq(deviceAccess.device_id, deviceId), eq(deviceAccess.user_id, userId)))
        .limit(1)

      if (existingAccess.length === 0) {
        await tx.insert(deviceAccess).values({
          device_id: deviceId,
          user_id: userId,
          granted_by: userId,
        })
      }

      // Assign profiles to device
      if (validProfileIds.length > 0) {
        // Remove existing profile assignments first
        await tx.delete(deviceCareProfiles).where(eq(deviceCareProfiles.device_id, deviceId))

        // Add new profile assignments
        await tx.insert(deviceCareProfiles).values(
          validProfileIds.map((profileId) => ({
            device_id: deviceId,
            care_profile_id: profileId,
          }))
        )
      }

      // Delete used pairing token
      await tx.delete(devicePairingTokens).where(eq(devicePairingTokens.id, pairingToken.id))
    })

    // Get updated device info
    const [device] = await db.select().from(devices).where(eq(devices.id, deviceId)).limit(1)

    const profiles = await db
      .select({
        id: careProfiles.id,
        name: careProfiles.name,
        avatar_url: careProfiles.avatar_url,
      })
      .from(deviceCareProfiles)
      .innerJoin(careProfiles, eq(deviceCareProfiles.care_profile_id, careProfiles.id))
      .where(eq(deviceCareProfiles.device_id, deviceId))

    // Notify device via WebSocket
    broadcastToDevice(deviceId, {
      type: 'device_paired',
      payload: {
        deviceId,
        profiles,
      },
    })

    res.json({
      id: device.id,
      name: device.name,
      status: device.status,
      pairedAt: device.paired_at,
      profiles,
    })
  } catch (err) {
    logger.error({ err }, 'POST /devices/pair error')
    res.status(500).json({ error: 'Failed to pair device' })
  }
})

/**
 * GET /api/devices/:id
 * Get device details (requires access).
 */
devicesRouter.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId
    const deviceId = req.params.id as string

    // Verify user has access
    const [access] = await db
      .select()
      .from(deviceAccess)
      .where(and(eq(deviceAccess.device_id, deviceId), eq(deviceAccess.user_id, userId)))
      .limit(1)

    if (!access) {
      res.status(404).json({ error: 'Device not found' })
      return
    }

    const [device] = await db.select().from(devices).where(eq(devices.id, deviceId)).limit(1)

    if (!device) {
      res.status(404).json({ error: 'Device not found' })
      return
    }

    const profiles = await db
      .select({
        id: careProfiles.id,
        name: careProfiles.name,
        avatar_url: careProfiles.avatar_url,
      })
      .from(deviceCareProfiles)
      .innerJoin(careProfiles, eq(deviceCareProfiles.care_profile_id, careProfiles.id))
      .where(eq(deviceCareProfiles.device_id, deviceId))

    res.json({
      id: device.id,
      name: device.name,
      status: device.status,
      batteryLevel: device.battery_level,
      lastSeenAt: device.last_seen_at,
      pairedAt: device.paired_at,
      createdAt: device.created_at,
      profiles,
    })
  } catch (err) {
    logger.error({ err }, 'GET /devices/:id error')
    res.status(500).json({ error: 'Failed to fetch device' })
  }
})

/**
 * PATCH /api/devices/:id
 * Update device name.
 */
devicesRouter.patch('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId
    const deviceId = req.params.id as string
    const { name } = req.body as { name?: string }

    // Verify user has access
    const [access] = await db
      .select()
      .from(deviceAccess)
      .where(and(eq(deviceAccess.device_id, deviceId), eq(deviceAccess.user_id, userId)))
      .limit(1)

    if (!access) {
      res.status(404).json({ error: 'Device not found' })
      return
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'name is required' })
      return
    }

    const [updated] = await db
      .update(devices)
      .set({ name: name.trim() })
      .where(eq(devices.id, deviceId))
      .returning()

    res.json(updated)
  } catch (err) {
    logger.error({ err }, 'PATCH /devices/:id error')
    res.status(500).json({ error: 'Failed to update device' })
  }
})

/**
 * DELETE /api/devices/:id
 * Unpair/remove device.
 */
devicesRouter.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId
    const deviceId = req.params.id as string

    // Verify user has access
    const [access] = await db
      .select()
      .from(deviceAccess)
      .where(and(eq(deviceAccess.device_id, deviceId), eq(deviceAccess.user_id, userId)))
      .limit(1)

    if (!access) {
      res.status(404).json({ error: 'Device not found' })
      return
    }

    // Notify device before deletion
    broadcastToDevice(deviceId, {
      type: 'device_revoked',
      payload: { deviceId },
    })

    // Delete device (cascades to device_care_profiles, device_access, device_pairing_tokens)
    await db.delete(devices).where(eq(devices.id, deviceId))

    res.status(204).send()
  } catch (err) {
    logger.error({ err }, 'DELETE /devices/:id error')
    res.status(500).json({ error: 'Failed to delete device' })
  }
})

/**
 * POST /api/devices/:id/profiles
 * Assign profiles to device.
 */
devicesRouter.post(
  '/:id/profiles',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId
      const deviceId = req.params.id as string
      const { profileIds } = req.body as { profileIds?: string[] }

      // Verify user has access
      const [access] = await db
        .select()
        .from(deviceAccess)
        .where(and(eq(deviceAccess.device_id, deviceId), eq(deviceAccess.user_id, userId)))
        .limit(1)

      if (!access) {
        res.status(404).json({ error: 'Device not found' })
        return
      }

      if (!profileIds || !Array.isArray(profileIds) || profileIds.length === 0) {
        res.status(400).json({ error: 'profileIds array is required' })
        return
      }

      // Verify user owns these profiles
      const userProfiles = await db
        .select({ id: careProfiles.id })
        .from(careProfiles)
        .where(and(eq(careProfiles.user_id, userId), inArray(careProfiles.id, profileIds)))

      const validIds = userProfiles.map((p) => p.id)
      if (validIds.length === 0) {
        res.status(400).json({ error: 'No valid profiles provided' })
        return
      }

      // Add profiles with ON CONFLICT DO NOTHING to avoid N+1 queries
      await db
        .insert(deviceCareProfiles)
        .values(
          validIds.map((profileId) => ({
            device_id: deviceId,
            care_profile_id: profileId,
          }))
        )
        .onConflictDoNothing()

      // Get updated profiles
      const profiles = await db
        .select({
          id: careProfiles.id,
          name: careProfiles.name,
          avatar_url: careProfiles.avatar_url,
        })
        .from(deviceCareProfiles)
        .innerJoin(careProfiles, eq(deviceCareProfiles.care_profile_id, careProfiles.id))
        .where(eq(deviceCareProfiles.device_id, deviceId))

      // Notify device
      broadcastToDevice(deviceId, {
        type: 'profiles_updated',
        payload: { profiles },
      })

      res.json({ profiles })
    } catch (err) {
      logger.error({ err }, 'POST /devices/:id/profiles error')
      res.status(500).json({ error: 'Failed to assign profiles' })
    }
  }
)

/**
 * DELETE /api/devices/:id/profiles/:profileId
 * Remove profile from device.
 */
devicesRouter.delete(
  '/:id/profiles/:profileId',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId
      const deviceId = req.params.id as string
      const profileId = req.params.profileId as string

      // Verify user has access
      const [access] = await db
        .select()
        .from(deviceAccess)
        .where(and(eq(deviceAccess.device_id, deviceId), eq(deviceAccess.user_id, userId)))
        .limit(1)

      if (!access) {
        res.status(404).json({ error: 'Device not found' })
        return
      }

      await db
        .delete(deviceCareProfiles)
        .where(
          and(
            eq(deviceCareProfiles.device_id, deviceId),
            eq(deviceCareProfiles.care_profile_id, profileId)
          )
        )

      // Get updated profiles
      const profiles = await db
        .select({
          id: careProfiles.id,
          name: careProfiles.name,
          avatar_url: careProfiles.avatar_url,
        })
        .from(deviceCareProfiles)
        .innerJoin(careProfiles, eq(deviceCareProfiles.care_profile_id, careProfiles.id))
        .where(eq(deviceCareProfiles.device_id, deviceId))

      // Notify device
      broadcastToDevice(deviceId, {
        type: 'profiles_updated',
        payload: { profiles },
      })

      res.status(204).send()
    } catch (err) {
      logger.error({ err }, 'DELETE /devices/:id/profiles/:profileId error')
      res.status(500).json({ error: 'Failed to remove profile' })
    }
  }
)
