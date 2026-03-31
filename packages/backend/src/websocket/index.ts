/** WebSocket server for kiosk real-time communication. */
import { WebSocketServer, WebSocket } from 'ws'
import { Server } from 'http'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { devices } from '@carehub/shared'
import { logger } from '../services/logger'

/** Connected devices map: deviceId → WebSocket */
const connectedDevices = new Map<string, WebSocket>()

/** WebSocket message types */
export interface WsMessage {
  type: string
  payload?: unknown
}

/** Heartbeat message from device */
interface HeartbeatMessage {
  type: 'heartbeat'
  payload: {
    batteryLevel?: number
  }
}

/** Status update from device */
interface StatusMessage {
  type: 'status_update'
  payload: {
    status: 'online' | 'offline'
  }
}

type DeviceMessage = HeartbeatMessage | StatusMessage

const PING_INTERVAL = 30000 // 30 seconds

/**
 * Initialize WebSocket server.
 * @param {Server} server - HTTP server instance
 */
export function initWebSocketServer(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/ws' })

  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url ?? '', `http://${req.headers.host}`)
    const deviceToken = url.searchParams.get('token')

    if (!deviceToken) {
      logger.warn('WebSocket connection rejected: no device token')
      ws.close(4001, 'Device token required')
      return
    }

    // Validate device token
    const [device] = await db
      .select()
      .from(devices)
      .where(eq(devices.device_token, deviceToken))
      .limit(1)

    if (!device) {
      logger.warn('WebSocket connection rejected: invalid device token')
      ws.close(4002, 'Invalid device token')
      return
    }

    const deviceId = device.id
    logger.info({ deviceId }, 'Device connected via WebSocket')

    // Store connection
    connectedDevices.set(deviceId, ws)

    // Update device status to online
    await db
      .update(devices)
      .set({ status: 'online', last_seen_at: new Date() })
      .where(eq(devices.id, deviceId))

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

          default:
            logger.warn({ deviceId, message }, 'Unknown message type from device')
        }
      } catch (err) {
        logger.error({ err, deviceId }, 'Error processing device message')
      }
    })

    // Handle pong (confirms connection is alive)
    ws.on('pong', () => {
      // Update last_seen_at on pong
      db.update(devices)
        .set({ last_seen_at: new Date() })
        .where(eq(devices.id, deviceId))
        .catch((err) => logger.error({ err, deviceId }, 'Error updating last_seen_at'))
    })

    // Handle disconnect
    ws.on('close', async () => {
      clearInterval(pingInterval)
      connectedDevices.delete(deviceId)
      logger.info({ deviceId }, 'Device disconnected')

      // Update device status to offline
      await db.update(devices).set({ status: 'offline' }).where(eq(devices.id, deviceId))
    })

    // Handle errors
    ws.on('error', (err) => {
      logger.error({ err, deviceId }, 'WebSocket error')
    })

    // Send connected confirmation
    ws.send(JSON.stringify({ type: 'connected', payload: { deviceId } }))
  })

  logger.info('WebSocket server initialized on /ws')
}

/**
 * Handle heartbeat message from device.
 */
async function handleHeartbeat(
  deviceId: string,
  payload: { batteryLevel?: number }
): Promise<void> {
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
async function handleStatusUpdate(
  deviceId: string,
  payload: { status: 'online' | 'offline' }
): Promise<void> {
  await db
    .update(devices)
    .set({ status: payload.status, last_seen_at: new Date() })
    .where(eq(devices.id, deviceId))
}

/**
 * Broadcast message to a specific device.
 * @param {string} deviceId - Target device ID
 * @param {WsMessage} message - Message to send
 * @returns {boolean} True if message was sent
 */
export function broadcastToDevice(deviceId: string, message: WsMessage): boolean {
  const ws = connectedDevices.get(deviceId)
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message))
    return true
  }
  return false
}

/**
 * Broadcast message to all connected devices.
 * @param {WsMessage} message - Message to send
 */
export function broadcastToAllDevices(message: WsMessage): void {
  const messageStr = JSON.stringify(message)
  for (const [deviceId, ws] of connectedDevices) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(messageStr)
    } else {
      connectedDevices.delete(deviceId)
    }
  }
}

/**
 * Check if a device is connected.
 * @param {string} deviceId - Device ID to check
 * @returns {boolean} True if device is connected
 */
export function isDeviceConnected(deviceId: string): boolean {
  const ws = connectedDevices.get(deviceId)
  return ws !== undefined && ws.readyState === WebSocket.OPEN
}

/**
 * Get count of connected devices.
 * @returns {number} Number of connected devices
 */
export function getConnectedDeviceCount(): number {
  return connectedDevices.size
}
