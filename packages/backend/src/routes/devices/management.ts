/** Device management endpoints — use user JWT auth. */
import { Router, Request, Response } from 'express'
import { eq, and } from 'drizzle-orm'
import { db } from '../../db'
import { devices, deviceAccess, deviceCareProfiles, careProfiles } from '@carehub/shared'
import { requireAuth } from '../../middleware/auth'
import { logger } from '../../services/logger'
import { broadcastToDevice } from '../../websocket'
import { validate } from '../../middleware/validate'
import { updateDeviceSchema } from '../../schemas/devices'

export const managementRouter = Router()

/**
 * GET /api/devices/:id
 * Get device details (requires access).
 */
managementRouter.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
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
managementRouter.patch('/:id', requireAuth, validate(updateDeviceSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId
    const deviceId = req.params.id as string
    const { name } = req.body as { name: string }

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

    const [updated] = await db
      .update(devices)
      .set({ name })
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
managementRouter.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
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
