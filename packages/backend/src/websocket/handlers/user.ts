/** User WebSocket handlers — JWT authentication and message routing. */
import { WebSocket } from 'ws'
import jwt from 'jsonwebtoken'
import { logger } from '../../services/logger'
import { addClient, removeClient, broadcastToDevice } from '../clients'
import type { UserMessage } from '../types'
import { handleCallMessage } from './call'
import { getActiveCallForUser, markCallFailed } from '../../services/call'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required')

interface JwtPayload {
  userId: string
  email: string
}

/**
 * Verify JWT token from query parameter.
 * @returns user payload if valid, null otherwise
 */
export const verifyUserToken = (token: string): JwtPayload | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload
  } catch {
    return null
  }
}

/**
 * Handle new user WebSocket connection.
 */
export const handleUserConnection = (
  ws: WebSocket,
  userId: string
): void => {
  logger.info({ userId }, 'User connected via WebSocket')

  // Add to client registry (supports multiple tabs)
  addClient('user', userId, ws)

  // Handle messages from user
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString()) as UserMessage

      switch (message.type) {
        // Call signaling messages from user
        case 'call:initiate':
        case 'call:ended':
        case 'call:offer':
        case 'call:ice-candidate':
          await handleCallMessage(ws, userId, 'user', message)
          break

        default:
          logger.warn({ userId, type: (message as { type: string }).type }, 'Unknown message type from user')
      }
    } catch (err) {
      logger.error({ err, userId }, 'Error processing user message')
    }
  })

  // Handle disconnect
  ws.on('close', async () => {
    removeClient('user', userId, ws)
    logger.info({ userId }, 'User disconnected')

    // Handle any active calls (mark as failed)
    const activeCall = await getActiveCallForUser(userId)
    if (activeCall) {
      await markCallFailed(activeCall.id)
      broadcastToDevice(activeCall.calleeDeviceId, {
        type: 'call:ended',
        callId: activeCall.id,
        reason: 'failed',
      })
    }
  })

  // Handle errors
  ws.on('error', (err) => {
    logger.error({ err, userId }, 'WebSocket error')
  })

  // Send connected confirmation
  ws.send(JSON.stringify({ type: 'connected', payload: { userId } }))
}
