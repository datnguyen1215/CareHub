/** Call signaling handlers — WebRTC offer/answer/ICE exchange. */
import { WebSocket } from 'ws'
import { RING_TIMEOUT_MS } from '@carehub/shared'
import { logger } from '../../services/logger'
import {
  updateCallStatus,
  endCall,
  validateCallPermission,
  getCallerInfo,
  startRingTimeout,
  clearRingTimeout,
  getCallSession,
  tryCreateCallSession,
} from '../../services/call'
import { broadcastToDevice, broadcastToUser, isDeviceConnected } from '../clients'
import type { ClientType } from '../clients'
import type {
  SignalingMessage,
  CallInitiateMessage,
  CallAcceptedMessage,
  CallDeclinedMessage,
  CallEndedMessage,
  CallOfferMessage,
  CallAnswerMessage,
  IceCandidateMessage,
  ScreenShareStateMessage,
} from '../types'

/**
 * Route incoming call message to appropriate handler.
 */
export const handleCallMessage = async (
  ws: WebSocket,
  senderId: string,
  senderType: ClientType,
  message: SignalingMessage
): Promise<void> => {
  switch (message.type) {
    case 'call:initiate':
      await handleCallInitiate(ws, senderId, message)
      break

    case 'call:accepted':
      await handleCallAccepted(ws, senderId, message)
      break

    case 'call:declined':
      await handleCallDeclined(ws, senderId, message)
      break

    case 'call:ended':
      await handleCallEnded(ws, senderId, senderType, message)
      break

    case 'call:offer':
      await handleOffer(ws, senderId, message)
      break

    case 'call:answer':
      await handleAnswer(ws, senderId, message)
      break

    case 'call:ice-candidate':
      await handleIceCandidate(ws, senderId, senderType, message)
      break

    case 'call:screen-share':
      await handleScreenShare(ws, senderId, senderType, message)
      break

    default:
      logger.warn({ senderId, senderType, message }, 'Unknown call message type')
  }
}

/**
 * Handle call initiation from user (portal).
 */
const handleCallInitiate = async (
  ws: WebSocket,
  userId: string,
  message: CallInitiateMessage
): Promise<void> => {
  const { deviceId, profileId } = message

  logger.info({ userId, deviceId, profileId }, 'Call initiate request')

  // Validate user has access to device
  const hasPermission = await validateCallPermission(userId, deviceId)
  if (!hasPermission) {
    sendError(ws, undefined, 'You do not have permission to call this device')
    return
  }

  // Check device is online
  if (!isDeviceConnected(deviceId)) {
    sendError(ws, undefined, 'Device is offline')
    return
  }

  // Atomically check for existing calls and create session (prevents TOCTOU race)
  const result = await tryCreateCallSession({
    callerUserId: userId,
    calleeDeviceId: deviceId,
    profileId,
  })

  if (!result.success) {
    const errorMsg =
      result.error === 'device_busy'
        ? 'Device is busy with another call'
        : 'You already have an active call'
    sendError(ws, undefined, errorMsg)
    return
  }

  const session = result.session

  // Get caller info for device display
  const caller = await getCallerInfo(userId)
  if (!caller) {
    await endCall(session.id, 'failed')
    sendError(ws, session.id, 'Failed to get caller information')
    return
  }

  // Send incoming call to device
  const sent = broadcastToDevice(deviceId, {
    type: 'call:incoming',
    callId: session.id,
    caller,
    profileId,
  })

  if (!sent) {
    await endCall(session.id, 'failed')
    sendError(ws, session.id, 'Failed to reach device')
    return
  }

  // Update status to ringing
  await updateCallStatus(session.id, 'ringing')

  // Start ring timeout
  startRingTimeout(session.id, RING_TIMEOUT_MS, () => {
    // Notify user that call was missed
    const userNotified = broadcastToUser(userId, {
      type: 'call:ended',
      callId: session.id,
      reason: 'missed',
    })
    if (userNotified === 0) {
      logger.warn({ callId: session.id, userId }, 'Missed call notification not delivered — user not connected')
    }
    // Notify kiosk device so it returns to idle
    const deviceNotified = broadcastToDevice(deviceId, {
      type: 'call:ended',
      callId: session.id,
      reason: 'missed',
    })
    if (!deviceNotified) {
      logger.warn({ callId: session.id, deviceId }, 'Missed call notification not delivered — device not connected')
    }
  })

  // Confirm to caller that call is ringing
  ws.send(
    JSON.stringify({
      type: 'call:ringing',
      callId: session.id,
    })
  )

  logger.info({ callId: session.id, userId, deviceId }, 'Call initiated, ringing device')
}

/**
 * Handle call accepted by device.
 */
const handleCallAccepted = async (
  _ws: WebSocket,
  deviceId: string,
  message: CallAcceptedMessage
): Promise<void> => {
  const { callId } = message

  logger.info({ callId, deviceId }, 'Call accepted by device')

  // Get call session
  const session = await getCallSession(callId)
  if (!session || session.calleeDeviceId === null || session.calleeDeviceId !== deviceId) {
    logger.warn({ callId, deviceId }, 'Invalid call accept - session not found or wrong device')
    return
  }

  // Validate call is still in ringing state (prevents overwriting ended/timed-out calls)
  if (session.status !== 'ringing') {
    logger.warn(
      { callId, deviceId, status: session.status },
      'Call accept ignored - not in ringing state'
    )
    return
  }

  // Clear ring timeout
  clearRingTimeout(callId)

  // Update status to connecting
  await updateCallStatus(callId, 'connecting')

  // Forward to caller
  const callerNotified = broadcastToUser(session.callerUserId, {
    type: 'call:accepted',
    callId,
  })

  if (callerNotified === 0) {
    logger.warn({ callId, userId: session.callerUserId, deviceId }, 'Call accepted — caller not connected, notification not delivered')
  } else {
    logger.info({ callId, userId: session.callerUserId, deviceId }, 'Call accepted, notified caller')
  }
}

/**
 * Handle call declined by device.
 */
const handleCallDeclined = async (
  _ws: WebSocket,
  deviceId: string,
  message: CallDeclinedMessage
): Promise<void> => {
  const { callId } = message

  logger.info({ callId, deviceId }, 'Call declined by device')

  // Get call session
  const session = await getCallSession(callId)
  if (!session || session.calleeDeviceId === null || session.calleeDeviceId !== deviceId) {
    logger.warn({ callId, deviceId }, 'Invalid call decline - session not found or wrong device')
    return
  }

  // Validate call is still in ringing state (prevents declining already-ended calls)
  if (session.status !== 'ringing') {
    logger.warn(
      { callId, deviceId, status: session.status },
      'Call decline ignored - not in ringing state'
    )
    return
  }

  // Clear ring timeout
  clearRingTimeout(callId)

  // End call with declined reason
  await endCall(callId, 'declined')

  // Forward to caller
  const callerNotified = broadcastToUser(session.callerUserId, {
    type: 'call:declined',
    callId,
  })

  if (callerNotified === 0) {
    logger.warn({ callId, userId: session.callerUserId, deviceId }, 'Call declined — caller not connected, notification not delivered')
  } else {
    logger.info({ callId, userId: session.callerUserId, deviceId }, 'Call declined, notified caller')
  }
}

/**
 * Handle call ended by either party.
 */
const handleCallEnded = async (
  _ws: WebSocket,
  senderId: string,
  senderType: ClientType,
  message: CallEndedMessage
): Promise<void> => {
  const { callId, reason } = message

  logger.info({ callId, senderId, senderType, reason }, 'Call ended')

  // Get call session
  const session = await getCallSession(callId)
  if (!session) {
    logger.warn({ callId }, 'Call end for unknown session')
    return
  }

  // Validate sender is part of the call
  const isValidSender =
    (senderType === 'user' && session.callerUserId === senderId) ||
    (senderType === 'device' && session.calleeDeviceId !== null && session.calleeDeviceId === senderId)

  if (!isValidSender) {
    logger.warn({ callId, senderId, senderType }, 'Unauthorized call end attempt')
    return
  }

  // Clear ring timeout
  clearRingTimeout(callId)

  // End call — returns false if already ended (prevents duplicate notifications)
  const wasEnded = await endCall(callId, reason)
  if (!wasEnded) {
    logger.debug({ callId, reason }, 'Call already ended, not notifying')
    return
  }

  // Notify the other party
  if (senderType === 'user') {
    if (session.calleeDeviceId !== null) {
      const deviceNotified = broadcastToDevice(session.calleeDeviceId, {
        type: 'call:ended',
        callId,
        reason,
      })
      if (!deviceNotified) {
        logger.warn({ callId, reason, deviceId: session.calleeDeviceId }, 'Call ended — device not connected, notification not delivered')
      } else {
        logger.info({ callId, reason }, 'Call ended, notified other party')
      }
    }
  } else {
    const callerNotified = broadcastToUser(session.callerUserId, {
      type: 'call:ended',
      callId,
      reason,
    })
    if (callerNotified === 0) {
      logger.warn({ callId, reason, userId: session.callerUserId }, 'Call ended — caller not connected, notification not delivered')
    } else {
      logger.info({ callId, reason }, 'Call ended, notified other party')
    }
  }
}

/**
 * Handle SDP offer from user (caller).
 */
const handleOffer = async (
  ws: WebSocket,
  userId: string,
  message: CallOfferMessage
): Promise<void> => {
  const { callId, sdp } = message

  logger.debug({ callId, userId }, 'Received SDP offer from user')

  // Get call session
  const session = await getCallSession(callId)
  if (!session || session.callerUserId !== userId || session.calleeDeviceId === null) {
    sendError(ws, callId, 'Invalid call session')
    return
  }

  // Forward offer to device
  const sent = broadcastToDevice(session.calleeDeviceId, {
    type: 'call:offer',
    callId,
    sdp,
  })

  if (!sent) {
    sendError(ws, callId, 'Failed to send offer to device')
  }
}

/**
 * Handle SDP answer from device (callee).
 */
const handleAnswer = async (
  ws: WebSocket,
  deviceId: string,
  message: CallAnswerMessage
): Promise<void> => {
  const { callId, sdp } = message

  logger.debug({ callId, deviceId }, 'Received SDP answer from device')

  // Get call session
  const session = await getCallSession(callId)
  if (!session || session.calleeDeviceId === null || session.calleeDeviceId !== deviceId) {
    sendError(ws, callId, 'Invalid call session')
    return
  }

  // Validate call is in connecting state (prevents overwriting ended calls)
  if (session.status !== 'connecting') {
    logger.warn(
      { callId, deviceId, status: session.status },
      'Call answer ignored - not in connecting state'
    )
    return
  }

  // Update status to connected
  await updateCallStatus(callId, 'connected')

  // Forward answer to user
  const callerNotified = broadcastToUser(session.callerUserId, {
    type: 'call:answer',
    callId,
    sdp,
  })

  if (callerNotified === 0) {
    logger.error({ callId, userId: session.callerUserId, deviceId }, 'SDP answer not delivered — caller not connected, call will hang')
  } else {
    logger.info({ callId }, 'Call connected')
  }
}

/**
 * Handle ICE candidate from either party.
 */
const handleIceCandidate = async (
  ws: WebSocket,
  senderId: string,
  senderType: ClientType,
  message: IceCandidateMessage
): Promise<void> => {
  const { callId, candidate } = message

  logger.debug({ callId, senderId, senderType }, 'Received ICE candidate')

  // Get call session
  const session = await getCallSession(callId)
  if (!session) {
    sendError(ws, callId, 'Invalid call session')
    return
  }

  // Validate sender is part of the call
  const isValidSender =
    (senderType === 'user' && session.callerUserId === senderId) ||
    (senderType === 'device' && session.calleeDeviceId !== null && session.calleeDeviceId === senderId)

  if (!isValidSender) {
    logger.warn({ callId, senderId, senderType }, 'Unauthorized ICE candidate')
    return
  }

  // Forward to the other party
  if (senderType === 'user') {
    if (session.calleeDeviceId !== null) {
      const deviceNotified = broadcastToDevice(session.calleeDeviceId, {
        type: 'call:ice-candidate',
        callId,
        candidate,
      })
      if (!deviceNotified) {
        logger.warn({ callId, deviceId: session.calleeDeviceId }, 'ICE candidate not delivered — device not connected')
      }
    }
  } else {
    const callerNotified = broadcastToUser(session.callerUserId, {
      type: 'call:ice-candidate',
      callId,
      candidate,
    })
    if (callerNotified === 0) {
      logger.warn({ callId, userId: session.callerUserId }, 'ICE candidate not delivered — caller not connected')
    }
  }
}

/**
 * Handle screen share state change from portal (caller) to kiosk.
 * Only the user (portal) can send this message; devices are ignored.
 */
const handleScreenShare = async (
  ws: WebSocket,
  senderId: string,
  senderType: ClientType,
  message: ScreenShareStateMessage
): Promise<void> => {
  const { callId, active } = message

  logger.debug({ callId, senderId, senderType, active }, 'Received screen share state')

  // Only portal can initiate screen share
  if (senderType !== 'user') {
    logger.warn({ callId, senderId, senderType }, 'Screen share ignored — only portal can share screen')
    return
  }

  // Get call session
  const session = await getCallSession(callId)
  if (!session || session.calleeDeviceId === null) {
    sendError(ws, callId, 'Invalid call session')
    return
  }

  // Validate sender is the caller
  if (session.callerUserId !== senderId) {
    logger.warn({ callId, senderId }, 'Unauthorized screen share attempt')
    return
  }

  // Validate call is in connected state
  if (session.status !== 'connected') {
    logger.warn(
      { callId, senderId, status: session.status },
      'Screen share ignored — call not connected'
    )
    return
  }

  // Forward to device
  const deviceNotified = broadcastToDevice(session.calleeDeviceId, {
    type: 'call:screen-share',
    callId,
    active,
  })
  if (!deviceNotified) {
    logger.warn({ callId, deviceId: session.calleeDeviceId }, 'Screen share state not delivered — device not connected')
  }
}

/**
 * Send error message to WebSocket client.
 * @param callId - Session ID if available, undefined for pre-session errors
 */
const sendError = (ws: WebSocket, callId: string | undefined, error: string): void => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type: 'call:error',
        ...(callId && { callId }),
        error,
      })
    )
  }
}
