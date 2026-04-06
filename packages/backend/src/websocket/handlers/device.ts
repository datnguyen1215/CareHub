/** Device WebSocket handlers — heartbeat, status updates. */
import { WebSocket } from 'ws'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { devices, deviceAccess } from '@carehub/shared'
import { logger } from '../../services/logger.js'
import { addClient, removeClient, broadcastToUser, getConnectedUserIds } from '../clients.js'
import type { DeviceMessage, DeviceStatusChangedMessage } from '../types.js'
import { handleCallMessage } from './call.js'
import { getActiveCallForDevice, markCallFailed } from '../../services/call.js'
import { TIMEOUTS } from '../../config/constants.js'

/**
 * Broadcast device status change to all connected portal users who have access to the device.
 * Skips DB query if no portal users are currently connected.
 */
const broadcastDeviceStatus = async (
  deviceId: string,
  status: 'online' | 'offline'
): Promise<void> => {
  const connectedUserIds = getConnectedUserIds()
  if (connectedUserIds.length === 0) return

  const accessRows = await db
    .select({ user_id: deviceAccess.user_id })
    .from(deviceAccess)
    .where(eq(deviceAccess.device_id, deviceId))

  const usersWithAccess = accessRows
    .map((row) => row.user_id)
    .filter((userId) => connectedUserIds.includes(userId))

  if (usersWithAccess.length === 0) return

  const message: DeviceStatusChangedMessage = { type: 'device_status_changed', deviceId, status }

  for (const userId of usersWithAccess) {
    broadcastToUser(userId, message)
  }

  logger.info(
    { deviceId, status, usersNotified: usersWithAccess.length },
    'Broadcast device_status_changed to portal users'
  )
}

/**
 * Handle new device WebSocket connection.
 */
export const handleDeviceConnection = async (ws: WebSocket, deviceId: string): Promise<void> => {
  logger.info({ deviceId }, 'Device connected via WebSocket')

  // Add to client registry
  addClient('device', deviceId, ws)

  // Update device status to online
  try {
    await db
      .update(devices)
      .set({ status: 'online', last_seen_at: new Date() })
      .where(eq(devices.id, deviceId))
  } catch (err) {
    logger.warn(
      { err, deviceId },
      'Device connected but failed to update status to online — DB status may be stale'
    )
  }

  // Notify portal users with access that device is now online
  try {
    await broadcastDeviceStatus(deviceId, 'online')
  } catch (err) {
    logger.warn(
      { err, deviceId },
      'Failed to broadcast device online status — portal users may have stale device status'
    )
  }

  // Setup ping interval
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping()
    }
  }, TIMEOUTS.DEVICE_PING_INTERVAL_MS)

  // Handle messages from device
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString()) as DeviceMessage

      switch (message.type) {
        case 'heartbeat':
          await handleHeartbeat(deviceId, message.payload)
          break

        case 'status_update':
          await handleStatusUpdate(deviceId, message.payload)
          break

        case 'app:update-status':
          await handleAppUpdateStatus(deviceId, message)
          break

        // Call signaling messages from device
        case 'call:accepted':
        case 'call:declined':
        case 'call:ended':
        case 'call:answer':
        case 'call:ice-candidate':
          await handleCallMessage(ws, deviceId, 'device', message)
          break

        default:
          logger.warn(
            { deviceId, type: (message as { type: string }).type },
            'Unknown message type from device'
          )
      }
    } catch (err) {
      logger.error({ err, deviceId }, 'Error processing device message')
    }
  })

  // Handle pong (confirms connection is alive)
  ws.on('pong', async () => {
    try {
      await db.update(devices).set({ last_seen_at: new Date() }).where(eq(devices.id, deviceId))
    } catch (err) {
      logger.error({ err, deviceId }, 'Error updating last_seen_at')
    }
  })

  // Handle disconnect
  ws.on('close', async () => {
    clearInterval(pingInterval)
    removeClient('device', deviceId, ws)
    logger.info({ deviceId }, 'Device disconnected')

    // Update device status to offline
    try {
      await db.update(devices).set({ status: 'offline' }).where(eq(devices.id, deviceId))
    } catch (err) {
      logger.warn(
        { err, deviceId },
        'Failed to update device status to offline — DB status may be stale'
      )
    }

    // Notify portal users with access that device is now offline
    try {
      await broadcastDeviceStatus(deviceId, 'offline')
    } catch (err) {
      logger.warn(
        { err, deviceId },
        'Failed to broadcast device offline status — portal users may have stale device status'
      )
    }

    // Handle any active calls (mark as failed)
    try {
      const activeCall = await getActiveCallForDevice(deviceId)
      if (activeCall) {
        await markCallFailed(activeCall.id)
        broadcastToUser(activeCall.callerUserId, {
          type: 'call:ended',
          callId: activeCall.id,
          reason: 'failed',
        })
      }
    } catch (err) {
      logger.error({ err, deviceId }, 'Failed to handle active call cleanup on device disconnect')
    }
  })

  // Handle errors
  ws.on('error', (err) => {
    logger.error({ err, deviceId }, 'WebSocket error')
  })

  // Send connected confirmation
  ws.send(JSON.stringify({ type: 'connected', payload: { deviceId } }))
}

/**
 * Handle heartbeat message from device.
 * Persists last_seen_at, and optionally battery_level and app_version when provided.
 */
const handleHeartbeat = async (
  deviceId: string,
  payload: { batteryLevel?: number; appVersion?: string }
): Promise<void> => {
  const updates: { last_seen_at: Date; battery_level?: number; app_version?: string } = {
    last_seen_at: new Date(),
  }

  if (typeof payload.batteryLevel === 'number') {
    updates.battery_level = payload.batteryLevel
  }

  if (typeof payload.appVersion === 'string') {
    updates.app_version = payload.appVersion
  }

  await db.update(devices).set(updates).where(eq(devices.id, deviceId))
}

/**
 * Handle app:update-status message from device.
 * - On success: persists new version to DB and notifies portal users.
 * - On failure: notifies portal users of the failure.
 * - On downloading/installing: forwards progress to portal users.
 */
const handleAppUpdateStatus = async (
  deviceId: string,
  message: { releaseId: string; status: string; version?: string; error?: string }
): Promise<void> => {
  const { releaseId, status, version, error } = message

  logger.info({ deviceId, releaseId, status }, 'Received app:update-status from device')

  if (status === 'success' && typeof version === 'string') {
    // Persist the new installed version
    await db.update(devices).set({ app_version: version }).where(eq(devices.id, deviceId))
    logger.info({ deviceId, version }, 'Device app version updated after successful OTA install')
  }

  // Notify portal users who have access to this device
  await broadcastDeviceStatus(deviceId, 'online')

  // Send the update status event to all portal users with access
  const connectedUserIds = getConnectedUserIds()
  if (connectedUserIds.length > 0) {
    const accessRows = await db
      .select({ user_id: deviceAccess.user_id })
      .from(deviceAccess)
      .where(eq(deviceAccess.device_id, deviceId))

    const usersWithAccess = accessRows
      .map((row) => row.user_id)
      .filter((userId) => connectedUserIds.includes(userId))

    const statusMessage = { type: 'app:update-status', deviceId, releaseId, status, version, error }
    for (const userId of usersWithAccess) {
      broadcastToUser(userId, statusMessage)
    }

    if (usersWithAccess.length > 0) {
      logger.info(
        { deviceId, releaseId, status, usersNotified: usersWithAccess.length },
        'Broadcast app:update-status to portal users'
      )
    }
  }
}

/**
 * Handle status update from device.
 */
const handleStatusUpdate = async (
  deviceId: string,
  payload: { status: 'online' | 'offline' }
): Promise<void> => {
  await db
    .update(devices)
    .set({ status: payload.status, last_seen_at: new Date() })
    .where(eq(devices.id, deviceId))
}
