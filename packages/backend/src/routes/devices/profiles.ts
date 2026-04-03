/** Device profile assignment endpoints — use user JWT auth. */
import { Router, Request, Response } from 'express'
import { eq, and, inArray } from 'drizzle-orm'
import { db } from '../../db'
import { deviceAccess, deviceCareProfiles, careProfiles } from '@carehub/shared'
import { requireAuth } from '../../middleware/auth'
import { logger } from '../../services/logger'
import { broadcastToDevice } from '../../websocket'
import { validate } from '../../middleware/validate'
import { assignProfilesSchema } from '../../schemas/devices'

export const profilesRouter = Router()

/**
 * POST /api/devices/:id/profiles
 * Assign profiles to device.
 */
profilesRouter.post(
  '/:id/profiles',
  requireAuth,
  validate(assignProfilesSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId
      const deviceId = req.params.id as string
      const { profileIds } = req.body as { profileIds: string[] }

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
profilesRouter.delete(
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
