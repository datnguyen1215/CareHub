/** WebSocket server for kiosk and portal real-time communication. */
import { WebSocketServer } from 'ws'
import { Server } from 'http'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { devices } from '@carehub/shared'
import { logger } from '../services/logger'
import { handleDeviceConnection } from './handlers/device'
import { handleUserConnection, verifyUserToken } from './handlers/user'
import { consumeWsTicket } from '../routes/auth'
import {
  clearAllClients,
  broadcastToDevice,
  broadcastToUser,
  broadcastToAllDevices,
  isDeviceConnected,
  isUserConnected,
  getConnectedDeviceCount,
  getConnectedUserCount,
} from './clients'

// Re-export types and utilities for external use
export type { WsMessage, SignalingMessage } from './types'
export {
  broadcastToDevice,
  broadcastToUser,
  broadcastToAllDevices,
  isDeviceConnected,
  isUserConnected,
  getConnectedDeviceCount,
  getConnectedUserCount,
}

/**
 * Initialize WebSocket server with dual authentication support.
 * - Devices connect with `token` query param (device token)
 * - Users connect with `jwt` query param (JWT token)
 * @param {Server} server - HTTP server instance
 */
export function initWebSocketServer(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/ws' })

  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url ?? '', `http://${req.headers.host}`)
    const deviceToken = url.searchParams.get('token')
    const userJwt = url.searchParams.get('jwt')
    const wsTicket = url.searchParams.get('ticket')

    // Route based on which auth param is provided
    if (deviceToken) {
      // Device authentication
      await handleDeviceAuth(ws, deviceToken)
    } else if (wsTicket) {
      // Ticket-based user authentication (Portal)
      handleTicketAuth(ws, wsTicket)
    } else if (userJwt) {
      // JWT-based user authentication (legacy)
      handleUserAuth(ws, userJwt)
    } else {
      logger.warn('WebSocket connection rejected: no auth token')
      ws.close(4001, 'Authentication required')
    }
  })

  // Handle server shutdown
  process.on('SIGTERM', () => {
    logger.info('WebSocket server shutting down')
    clearAllClients()
    wss.close()
  })

  process.on('SIGINT', () => {
    logger.info('WebSocket server shutting down')
    clearAllClients()
    wss.close()
  })

  logger.info('WebSocket server initialized on /ws')
}

/**
 * Authenticate device connection via device token.
 */
async function handleDeviceAuth(ws: import('ws').WebSocket, deviceToken: string): Promise<void> {
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

  handleDeviceConnection(ws, device.id)
}

/**
 * Authenticate user connection via JWT.
 */
function handleUserAuth(ws: import('ws').WebSocket, jwt: string): void {
  const payload = verifyUserToken(jwt)

  if (!payload) {
    logger.warn('WebSocket connection rejected: invalid JWT')
    ws.close(4003, 'Invalid JWT token')
    return
  }

  handleUserConnection(ws, payload.userId)
}

/**
 * Authenticate user connection via one-time ticket (Portal).
 */
function handleTicketAuth(ws: import('ws').WebSocket, ticket: string): void {
  const userId = consumeWsTicket(ticket)

  if (!userId) {
    logger.warn('WebSocket connection rejected: invalid or expired ticket')
    ws.close(4004, 'Invalid or expired ticket')
    return
  }

  handleUserConnection(ws, userId)
}
