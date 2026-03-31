/** Call service — manages call session database operations. */
import { eq, and, notInArray } from 'drizzle-orm'
import { db } from '../db'
import { callSessions, deviceAccess, users } from '@carehub/shared'
import type { CallStatus, CallEndReason, CallParticipant } from '@carehub/shared'
import { logger } from './logger'

/** Terminal call statuses — calls in these states are considered ended */
const TERMINAL_STATUSES: CallStatus[] = ['ended', 'failed']

/** Ring timeout timers by call ID */
const ringTimeouts = new Map<string, NodeJS.Timeout>()

export interface CreateCallSessionParams {
  callerUserId: string
  calleeDeviceId: string
  profileId: string | null
}

export interface CallSessionRecord {
  id: string
  callerUserId: string
  calleeDeviceId: string
  calleeProfileId: string | null
  status: CallStatus
  initiatedAt: Date
  answeredAt: Date | null
  endedAt: Date | null
  endReason: CallEndReason | null
  durationSeconds: number | null
  iceConnectionState: string | null
}

/**
 * Create a new call session record.
 */
export const createCallSession = async (
  params: CreateCallSessionParams
): Promise<CallSessionRecord> => {
  const [session] = await db
    .insert(callSessions)
    .values({
      caller_user_id: params.callerUserId,
      callee_device_id: params.calleeDeviceId,
      callee_profile_id: params.profileId,
      status: 'initiating',
    })
    .returning()

  logger.info(
    { callId: session.id, caller: params.callerUserId, device: params.calleeDeviceId },
    'Call session created'
  )

  return mapSessionToRecord(session)
}

/**
 * Update call session status.
 */
export const updateCallStatus = async (sessionId: string, status: CallStatus): Promise<void> => {
  const updates: Record<string, unknown> = { status }

  if (status === 'connecting') {
    updates.answered_at = new Date()
  }

  await db.update(callSessions).set(updates).where(eq(callSessions.id, sessionId))

  logger.debug({ callId: sessionId, status }, 'Call status updated')
}

/**
 * End a call session with reason.
 * Uses a transaction to atomically read answeredAt and update the session.
 */
export const endCall = async (sessionId: string, reason: CallEndReason): Promise<void> => {
  const endedAt = new Date()

  const durationSeconds = await db.transaction(async (tx) => {
    // Get current session to calculate duration (within transaction)
    const [session] = await tx
      .select({ answeredAt: callSessions.answered_at })
      .from(callSessions)
      .where(eq(callSessions.id, sessionId))
      .limit(1)

    let duration: number | null = null
    if (session?.answeredAt) {
      duration = Math.round((endedAt.getTime() - session.answeredAt.getTime()) / 1000)
    }

    await tx
      .update(callSessions)
      .set({
        status: 'ended',
        ended_at: endedAt,
        end_reason: reason,
        duration_seconds: duration,
      })
      .where(eq(callSessions.id, sessionId))

    return duration
  })

  // Clear any pending ring timeout
  clearRingTimeout(sessionId)

  logger.info({ callId: sessionId, reason, durationSeconds }, 'Call ended')
}

/**
 * Get active (non-terminal) call for a device.
 */
export const getActiveCallForDevice = async (
  deviceId: string
): Promise<CallSessionRecord | null> => {
  const [session] = await db
    .select()
    .from(callSessions)
    .where(
      and(
        eq(callSessions.callee_device_id, deviceId),
        notInArray(callSessions.status, TERMINAL_STATUSES)
      )
    )
    .limit(1)

  return session ? mapSessionToRecord(session) : null
}

/**
 * Get call session by ID.
 */
export const getCallSession = async (sessionId: string): Promise<CallSessionRecord | null> => {
  const [session] = await db
    .select()
    .from(callSessions)
    .where(eq(callSessions.id, sessionId))
    .limit(1)

  return session ? mapSessionToRecord(session) : null
}

/**
 * Validate that a user has permission to call a device.
 */
export const validateCallPermission = async (
  userId: string,
  deviceId: string
): Promise<boolean> => {
  const [access] = await db
    .select()
    .from(deviceAccess)
    .where(and(eq(deviceAccess.device_id, deviceId), eq(deviceAccess.user_id, userId)))
    .limit(1)

  return access !== undefined
}

/**
 * Get caller participant info for display on kiosk.
 */
export const getCallerInfo = async (userId: string): Promise<CallParticipant | null> => {
  const [user] = await db
    .select({
      id: users.id,
      firstName: users.first_name,
      lastName: users.last_name,
      avatarUrl: users.avatar_url,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user) return null

  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Unknown User'

  return {
    userId: user.id,
    name,
    avatarUrl: user.avatarUrl,
  }
}

/**
 * Start ring timeout timer for a call.
 * After timeout, marks call as missed.
 */
export const startRingTimeout = (
  sessionId: string,
  timeoutMs: number,
  onTimeout: () => void
): void => {
  clearRingTimeout(sessionId)

  const timer = setTimeout(() => {
    ringTimeouts.delete(sessionId)
    handleRingTimeout(sessionId)
      .then(() => onTimeout())
      .catch((err) => logger.error({ err, callId: sessionId }, 'Error handling ring timeout'))
  }, timeoutMs)

  ringTimeouts.set(sessionId, timer)
  logger.debug({ callId: sessionId, timeoutMs }, 'Ring timeout started')
}

/**
 * Clear ring timeout timer.
 */
export const clearRingTimeout = (sessionId: string): void => {
  const timer = ringTimeouts.get(sessionId)
  if (timer) {
    clearTimeout(timer)
    ringTimeouts.delete(sessionId)
    logger.debug({ callId: sessionId }, 'Ring timeout cleared')
  }
}

/**
 * Handle ring timeout — mark call as missed.
 */
const handleRingTimeout = async (sessionId: string): Promise<void> => {
  const session = await getCallSession(sessionId)

  // Only mark as missed if still in ringing state
  if (session && session.status === 'ringing') {
    await endCall(sessionId, 'missed')
    logger.info({ callId: sessionId }, 'Call marked as missed (ring timeout)')
  }
}

/**
 * Mark call as failed (e.g., due to disconnect).
 */
export const markCallFailed = async (sessionId: string): Promise<void> => {
  await endCall(sessionId, 'failed')
}

/**
 * Get active call for a user (caller).
 */
export const getActiveCallForUser = async (userId: string): Promise<CallSessionRecord | null> => {
  const [session] = await db
    .select()
    .from(callSessions)
    .where(
      and(
        eq(callSessions.caller_user_id, userId),
        notInArray(callSessions.status, TERMINAL_STATUSES)
      )
    )
    .limit(1)

  return session ? mapSessionToRecord(session) : null
}

export type TryCreateCallResult =
  | { success: true; session: CallSessionRecord }
  | { success: false; error: 'device_busy' | 'user_busy' }

/**
 * Atomically check for existing active calls and create a new session.
 * Uses a database transaction to prevent race conditions (TOCTOU).
 */
export const tryCreateCallSession = async (
  params: CreateCallSessionParams
): Promise<TryCreateCallResult> => {
  return db.transaction(async (tx) => {
    // Check no active call on device (within transaction)
    const [existingDeviceCall] = await tx
      .select({ id: callSessions.id })
      .from(callSessions)
      .where(
        and(
          eq(callSessions.callee_device_id, params.calleeDeviceId),
          notInArray(callSessions.status, TERMINAL_STATUSES)
        )
      )
      .limit(1)

    if (existingDeviceCall) {
      return { success: false, error: 'device_busy' }
    }

    // Check no active call for user (within transaction)
    const [existingUserCall] = await tx
      .select({ id: callSessions.id })
      .from(callSessions)
      .where(
        and(
          eq(callSessions.caller_user_id, params.callerUserId),
          notInArray(callSessions.status, TERMINAL_STATUSES)
        )
      )
      .limit(1)

    if (existingUserCall) {
      return { success: false, error: 'user_busy' }
    }

    // Create the session (within same transaction)
    const [session] = await tx
      .insert(callSessions)
      .values({
        caller_user_id: params.callerUserId,
        callee_device_id: params.calleeDeviceId,
        callee_profile_id: params.profileId,
        status: 'initiating',
      })
      .returning()

    logger.info(
      { callId: session.id, caller: params.callerUserId, device: params.calleeDeviceId },
      'Call session created (atomic)'
    )

    return { success: true, session: mapSessionToRecord(session) }
  })
}

/** Map database row to typed record */
const mapSessionToRecord = (row: {
  id: string
  caller_user_id: string
  callee_device_id: string
  callee_profile_id: string | null
  status: CallStatus
  initiated_at: Date
  answered_at: Date | null
  ended_at: Date | null
  end_reason: CallEndReason | null
  duration_seconds: number | null
  ice_connection_state: string | null
}): CallSessionRecord => ({
  id: row.id,
  callerUserId: row.caller_user_id,
  calleeDeviceId: row.callee_device_id,
  calleeProfileId: row.callee_profile_id,
  status: row.status,
  initiatedAt: row.initiated_at,
  answeredAt: row.answered_at,
  endedAt: row.ended_at,
  endReason: row.end_reason,
  durationSeconds: row.duration_seconds,
  iceConnectionState: row.ice_connection_state,
})
