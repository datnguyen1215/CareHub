/** Caretaker device pairing endpoints — use user JWT auth. */
import { Router, Request, Response } from 'express'
import { eq, and, gt, inArray } from 'drizzle-orm'
import { db } from '../../db'
import { devices, deviceCareProfiles, deviceAccess, devicePairingTokens, careProfiles } from '@carehub/shared'
import { requireAuth } from '../../middleware/auth'
import { logger } from '../../services/logger'
import { broadcastToDevice, isDeviceConnected } from '../../websocket'
import { validate } from '../../middleware/validate'
import { pairDeviceSchema } from '../../schemas/devices'

export const pairingRouter = Router()

/**
 * GET /api/devices
 * List devices the authenticated user has access to.
 */
pairingRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId

    // Single query: devices + their profiles via LEFT JOIN
    const rows = await db
      .select({
        id: devices.id,
        name: devices.name,
        status: devices.status,
        battery_level: devices.battery_level,
        last_seen_at: devices.last_seen_at,
        paired_at: devices.paired_at,
        created_at: devices.created_at,
        profile_id: careProfiles.id,
        profile_name: careProfiles.name,
        profile_avatar_url: careProfiles.avatar_url,
      })
      .from(deviceAccess)
      .innerJoin(devices, eq(deviceAccess.device_id, devices.id))
      .leftJoin(deviceCareProfiles, eq(deviceCareProfiles.device_id, devices.id))
      .leftJoin(careProfiles, eq(deviceCareProfiles.care_profile_id, careProfiles.id))
      .where(eq(deviceAccess.user_id, userId))

    // Group profiles by device
    const deviceMap = new Map<string, {
      id: string
      name: string
      status: string
      battery_level: number | null
      last_seen_at: Date | null
      paired_at: Date | null
      created_at: Date
      profiles: { id: string; name: string; avatar_url: string | null }[]
    }>()

    for (const row of rows) {
      if (!deviceMap.has(row.id)) {
        deviceMap.set(row.id, {
          id: row.id,
          name: row.name,
          status: row.status,
          battery_level: row.battery_level,
          last_seen_at: row.last_seen_at,
          paired_at: row.paired_at,
          created_at: row.created_at,
          profiles: [],
        })
      }
      if (row.profile_id) {
        deviceMap.get(row.id)!.profiles.push({
          id: row.profile_id,
          name: row.profile_name ?? '',
          avatar_url: row.profile_avatar_url,
        })
      }
    }

    res.json(Array.from(deviceMap.values()))
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
pairingRouter.post('/pair', requireAuth, validate(pairDeviceSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId
    const { token, profileIds } = req.body as { token: string; profileIds?: string[] }

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
