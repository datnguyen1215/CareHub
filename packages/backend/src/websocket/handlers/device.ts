/** Device WebSocket handlers — heartbeat, status updates. */
import { WebSocket } from 'ws'
import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { devices } from '@carehub/shared'
import { logger } from '../../services/logger'
import { addClient, removeClient } from '../clients'
import type { DeviceMessage } from '../types'
import { handleCallMessage } from './call'

const PING_INTERVAL = 30000 // 30 seconds

/**
 * Handle new device WebSocket connection.
 */
export const handleDeviceConnection = (
  ws: WebSocket,
  deviceId: string
): void => {
  logger.info({ deviceId }, 'Device connected via WebSocket')

  // Add to client registry
  addClient('device', deviceId, ws)

  // Update device status to online
  db.update(devices)
    .set({ status: 'online', last_seen_at: new Date() })
    .where(eq(devices.id, deviceId))
    .catch((err) => logger.error({ err, deviceId }, 'Error updating device status'))

  // Setup ping interval
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping()
    }
  }, PING_INTERVAL)

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

        // Call signaling messages from device
        case 'call:accepted':
        case 'call:declined':
        case 'call:ended':
        case 'call:answer':
        case 'call:ice-candidate':
          await handleCallMessage(ws, deviceId, 'device', message)
          break

        default:
          logger.warn({ deviceId, type: (message as { type: string }).type }, 'Unknown message type from device')
      }
    } catch (err) {
      logger.error({ err, deviceId }, 'Error processing device message')
    }
  })

  // Handle pong (confirms connection is alive)
  ws.on('pong', () => {
    db.update(devices)
      .set({ last_seen_at: new Date() })
      .where(eq(devices.id, deviceId))
      .catch((err) => logger.error({ err, deviceId }, 'Error updating last_seen_at'))
  })

  // Handle disconnect
  ws.on('close', async () => {
    clearInterval(pingInterval)
    removeClient('device', deviceId, ws)
    logger.info({ deviceId }, 'Device disconnected')

    // Update device status to offline
    await db.update(devices).set({ status: 'offline' }).where(eq(devices.id, deviceId))

    // Handle any active calls (mark as failed)
    const { getActiveCallForDevice, markCallFailed } = await import('../../services/call')
    const { broadcastToUser } = await import('../clients')

    const activeCall = await getActiveCallForDevice(deviceId)
    if (activeCall) {
      await markCallFailed(activeCall.id)
      broadcastToUser(activeCall.callerUserId, {
        type: 'call:ended',
        callId: activeCall.id,
        reason: 'failed',
      })
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
 */
const handleHeartbeat = async (
  deviceId: string,
  payload: { batteryLevel?: number }
): Promise<void> => {
  const updates: { last_seen_at: Date; battery_level?: number } = {
    last_seen_at: new Date(),
  }

  if (typeof payload.batteryLevel === 'number') {
    updates.battery_level = payload.batteryLevel
  }

  await db.update(devices).set(updates).where(eq(devices.id, deviceId))
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
