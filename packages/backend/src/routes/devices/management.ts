/** Device management endpoints — use user JWT auth. */
import { Router, Request, Response } from 'express'
import { eq, and, notInArray } from 'drizzle-orm'
import { db } from '../../db/index.js'
import {
  devices,
  deviceAccess,
  deviceCareProfiles,
  careProfiles,
  callSessions,
  appReleases,
} from '@carehub/shared'
import type { CallStatus, CallEndReason } from '@carehub/shared'
import { requireAuth } from '../../middleware/auth.js'
import { logger } from '../../services/logger.js'
import { broadcastToDevice, broadcastToUser } from '../../websocket/index.js'
import { validate } from '../../middleware/validate.js'
import { updateDeviceSchema } from '../../schemas/devices.js'

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

    const profileRows = await db
      .select({
        id: careProfiles.id,
        name: careProfiles.name,
        avatar_url: careProfiles.avatar_url,
      })
      .from(deviceCareProfiles)
      .leftJoin(careProfiles, eq(deviceCareProfiles.care_profile_id, careProfiles.id))
      .where(eq(deviceCareProfiles.device_id, deviceId))

    const profiles = profileRows.filter((p) => p.id !== null)

    res.json({
      id: device.id,
      name: device.name,
      status: device.status,
      batteryLevel: device.battery_level,
      appVersion: device.app_version,
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
managementRouter.patch(
  '/:id',
  requireAuth,
  validate(updateDeviceSchema),
  async (req: Request, res: Response): Promise<void> => {
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
  }
)

/**
 * POST /api/devices/:id/update
 *
 * Trigger an OTA app update on a connected kiosk device.
 *
 * Request body: { releaseId: string }
 * Response 200: { status: "update_triggered" }
 * Response 404: device not found / no access / release not found
 * Response 409: device is offline
 * Response 500: internal server error
 *
 * Sends an `app:update` WebSocket message to the device with download URL, version, and checksum.
 * The download URL points to GET /api/releases/:id/download, which requires device-token auth.
 */
managementRouter.post(
  '/:id/update',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId
      const deviceId = req.params.id as string
      const { releaseId } = req.body as { releaseId?: string }

      if (!releaseId || typeof releaseId !== 'string') {
        res.status(400).json({ error: 'releaseId is required' })
        return
      }

      // Verify user has access to this device
      const [access] = await db
        .select()
        .from(deviceAccess)
        .where(and(eq(deviceAccess.device_id, deviceId), eq(deviceAccess.user_id, userId)))
        .limit(1)

      if (!access) {
        res.status(404).json({ error: 'Device not found' })
        return
      }

      // Look up the release
      const [release] = await db
        .select()
        .from(appReleases)
        .where(eq(appReleases.id, releaseId))
        .limit(1)

      if (!release) {
        res.status(404).json({ error: 'Release not found' })
        return
      }

      // Build download URL — device fetches APK via the authenticated download endpoint
      const baseUrl = `${req.protocol}://${req.get('host')}`
      const downloadUrl = `${baseUrl}/api/releases/${release.id}/download`

      // Forward the update command to the device.
      // broadcastToDevice returns false if the device is not connected (checks readyState),
      // which also handles the TOCTOU race between a connectivity check and actual send.
      const sent = broadcastToDevice(deviceId, {
        type: 'app:update',
        releaseId: release.id,
        version: release.version,
        downloadUrl,
        checksum: release.checksum,
      })

      if (!sent) {
        res.status(409).json({ error: 'Device is offline' })
        return
      }

      logger.info(
        { deviceId, releaseId: release.id, version: release.version },
        'OTA update triggered for device'
      )

      res.json({ status: 'update_triggered' })
    } catch (err) {
      logger.error({ err }, 'POST /devices/:id/update error')
      res.status(500).json({ error: 'Failed to trigger update' })
    }
  }
)

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

    const TERMINAL_STATUSES: CallStatus[] = ['ended', 'failed']

    // Atomically: end any active call + delete device in a single transaction.
    // WebSocket broadcasts are side effects and run after commit.
    const endedCall = await db.transaction(async (tx) => {
      // Find and end any active call for this device (inline — endCall() uses its own tx)
      const [activeCallRow] = await tx
        .select({
          id: callSessions.id,
          callerUserId: callSessions.caller_user_id,
          answeredAt: callSessions.answered_at,
        })
        .from(callSessions)
        .where(
          and(
            eq(callSessions.callee_device_id, deviceId),
            notInArray(callSessions.status, TERMINAL_STATUSES)
          )
        )
        .limit(1)

      let endedCallInfo: { id: string; callerUserId: string } | null = null

      if (activeCallRow) {
        const endedAt = new Date()
        let duration: number | null = null
        if (activeCallRow.answeredAt) {
          duration = Math.round((endedAt.getTime() - activeCallRow.answeredAt.getTime()) / 1000)
        }

        await tx
          .update(callSessions)
          .set({
            status: 'ended' as CallStatus,
            ended_at: endedAt,
            end_reason: 'cancelled' as CallEndReason,
            duration_seconds: duration,
          })
          .where(
            and(
              eq(callSessions.id, activeCallRow.id),
              notInArray(callSessions.status, TERMINAL_STATUSES)
            )
          )

        endedCallInfo = { id: activeCallRow.id, callerUserId: activeCallRow.callerUserId }
        logger.info(
          { callId: activeCallRow.id, deviceId },
          'Active call cancelled before device deletion'
        )
      }

      // Delete device (cascades to device_care_profiles, device_access, device_pairing_tokens)
      // call_sessions.callee_device_id is set to NULL by FK ON DELETE SET NULL
      await tx.delete(devices).where(eq(devices.id, deviceId))

      return endedCallInfo
    })

    // Broadcast side effects after transaction commits
    if (endedCall) {
      broadcastToUser(endedCall.callerUserId, {
        type: 'call:ended',
        callId: endedCall.id,
        reason: 'cancelled',
      })
      broadcastToDevice(deviceId, {
        type: 'call:ended',
        callId: endedCall.id,
        reason: 'cancelled',
      })
    }

    // Notify device it has been unpaired
    broadcastToDevice(deviceId, {
      type: 'device_revoked',
      payload: { deviceId },
    })

    res.status(204).send()
  } catch (err) {
    logger.error({ err }, 'DELETE /devices/:id error')
    res.status(500).json({ error: 'Failed to delete device' })
  }
})
