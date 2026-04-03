import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { truncateAll } from '../helpers/truncate'
import {
  createTestServer,
  connectWs,
  waitForMessage,
  closeWs,
  makeUserJwt,
} from '../helpers/ws'
import { createDevice, createUser, createDeviceAccess, createProfile } from '../factories'
import { db } from '../../src/db'
import { callSessions } from '@carehub/shared'
import { eq } from 'drizzle-orm'

describe('WebSocket Call Signaling', () => {
  const testServer = createTestServer()
  let port: number
  const sockets: import('ws').WebSocket[] = []

  beforeAll(async () => {
    await truncateAll()
    port = await testServer.start()
  })

  afterEach(async () => {
    vi.useRealTimers()
    await Promise.all(sockets.map((s) => closeWs(s)))
    sockets.length = 0
  })

  afterAll(async () => {
    await testServer.close()
  })

  function track(ws: import('ws').WebSocket) {
    sockets.push(ws)
    return ws
  }

  /**
   * Helper: set up a user, device, and access so they can call each other.
   * Returns the user, device, user WS, and device WS (already connected).
   */
  async function setupCallParticipants() {
    const user = await createUser({
      email: 'call-test@example.com',
      first_name: 'John',
      last_name: 'Doe',
    })
    const profile = await createProfile({ user_id: user.id, name: 'Test Profile' })
    const device = await createDevice({
      device_token: 'call-test-device-token',
      name: 'Call Test Kiosk',
    })
    await createDeviceAccess({ device_id: device.id, user_id: user.id })

    const userWs = track(await connectWs(port, { jwt: makeUserJwt(user.id, user.email) }))
    const deviceWs = track(await connectWs(port, { token: device.device_token }))

    await waitForMessage(userWs)
    await waitForMessage(deviceWs)

    return { user, profile, device, userWs, deviceWs }
  }

  // -------------------------------------------------------
  // Call Initiation
  // -------------------------------------------------------

  it('user initiates call to online device with access — device receives call:incoming', async () => {
    const { user, profile, device, userWs, deviceWs } = await setupCallParticipants()

    // User initiates call
    userWs.send(
      JSON.stringify({
        type: 'call:initiate',
        callId: crypto.randomUUID(),
        deviceId: device.id,
        profileId: profile.id,
      })
    )

    // User should get call:ringing
    const ringing = await waitForMessage<{ type: string; callId: string }>(userWs)
    expect(ringing.type).toBe('call:ringing')
    expect(ringing.callId).toBeDefined()

    // Device should get call:incoming
    const incoming = await waitForMessage<{
      type: string
      callId: string
      caller: { userId: string; name: string; avatarUrl: string | null }
      profileId: string
    }>(deviceWs)
    expect(incoming.type).toBe('call:incoming')
    expect(incoming.callId).toBe(ringing.callId)
    expect(incoming.caller.userId).toBe(user.id)
    expect(incoming.caller.name).toBe('John Doe')
  })

  it('user initiates call to offline device — receives error response', async () => {
    const user = await createUser({
      email: 'call-offline@example.com',
      first_name: 'Jane',
    })
    const profile = await createProfile({ user_id: user.id, name: 'Offline Profile' })
    const device = await createDevice({
      device_token: 'offline-call-device-token',
      name: 'Offline Kiosk',
      status: 'offline',
    })
    await createDeviceAccess({ device_id: device.id, user_id: user.id })

    const userWs = track(await connectWs(port, { jwt: makeUserJwt(user.id, user.email) }))
    await waitForMessage(userWs)

    userWs.send(
      JSON.stringify({
        type: 'call:initiate',
        callId: crypto.randomUUID(),
        deviceId: device.id,
        profileId: profile.id,
      })
    )

    const error = await waitForMessage<{ type: string; error: string }>(userWs)
    expect(error.type).toBe('call:error')
    expect(error.error).toContain('offline')
  })

  it('user initiates call without device access — receives error response', async () => {
    const user = await createUser({ email: 'call-no-access@example.com' })
    const profile = await createProfile({ user_id: user.id, name: 'No Access Profile' })
    const device = await createDevice({
      device_token: 'no-access-call-device',
      name: 'No Access Kiosk',
    })
    // No createDeviceAccess — user has no permission

    const userWs = track(await connectWs(port, { jwt: makeUserJwt(user.id, user.email) }))
    const deviceWs = track(await connectWs(port, { token: device.device_token }))
    await waitForMessage(userWs)
    await waitForMessage(deviceWs)

    userWs.send(
      JSON.stringify({
        type: 'call:initiate',
        callId: crypto.randomUUID(),
        deviceId: device.id,
        profileId: profile.id,
      })
    )

    const error = await waitForMessage<{ type: string; error: string }>(userWs)
    expect(error.type).toBe('call:error')
    expect(error.error).toContain('permission')
  })

  // -------------------------------------------------------
  // Accept / Decline
  // -------------------------------------------------------

  it('device accepts call — user receives call:accepted, DB status updated', async () => {
    const { user, profile, device, userWs, deviceWs } = await setupCallParticipants()

    // Initiate call
    userWs.send(
      JSON.stringify({
        type: 'call:initiate',
        callId: crypto.randomUUID(),
        deviceId: device.id,
        profileId: profile.id,
      })
    )

    const ringing = await waitForMessage<{ type: string; callId: string }>(userWs)
    await waitForMessage(deviceWs) // call:incoming on device

    // Device accepts
    deviceWs.send(JSON.stringify({ type: 'call:accepted', callId: ringing.callId }))

    // User should get call:accepted
    const accepted = await waitForMessage<{ type: string; callId: string }>(userWs)
    expect(accepted.type).toBe('call:accepted')
    expect(accepted.callId).toBe(ringing.callId)

    // Verify DB status is 'connecting'
    const [session] = await db
      .select()
      .from(callSessions)
      .where(eq(callSessions.id, ringing.callId))
    expect(session.status).toBe('connecting')
  })

  it('device declines call — user receives call:declined, DB status updated', async () => {
    const { user, profile, device, userWs, deviceWs } = await setupCallParticipants()

    userWs.send(
      JSON.stringify({
        type: 'call:initiate',
        callId: crypto.randomUUID(),
        deviceId: device.id,
        profileId: profile.id,
      })
    )

    const ringing = await waitForMessage<{ type: string; callId: string }>(userWs)
    await waitForMessage(deviceWs) // call:incoming

    // Device declines
    deviceWs.send(JSON.stringify({ type: 'call:declined', callId: ringing.callId }))

    const declined = await waitForMessage<{ type: string; callId: string }>(userWs)
    expect(declined.type).toBe('call:declined')
    expect(declined.callId).toBe(ringing.callId)

    // Verify DB session is ended
    const [session] = await db
      .select()
      .from(callSessions)
      .where(eq(callSessions.id, ringing.callId))
    expect(session.status).toBe('ended')
    expect(session.end_reason).toBe('declined')
  })

  // -------------------------------------------------------
  // WebRTC offer/answer/ICE exchange
  // -------------------------------------------------------

  it('WebRTC offer/answer/ICE exchange — messages routed correctly', async () => {
    const { user, profile, device, userWs, deviceWs } = await setupCallParticipants()

    // Initiate and accept call
    userWs.send(
      JSON.stringify({
        type: 'call:initiate',
        callId: crypto.randomUUID(),
        deviceId: device.id,
        profileId: profile.id,
      })
    )

    const ringing = await waitForMessage<{ type: string; callId: string }>(userWs)
    const incoming = await waitForMessage<{ type: string; callId: string }>(deviceWs)

    // Device accepts
    deviceWs.send(JSON.stringify({ type: 'call:accepted', callId: ringing.callId }))
    await waitForMessage(userWs) // call:accepted

    // User sends offer
    const offerSdp = 'mock-offer-sdp'
    userWs.send(
      JSON.stringify({
        type: 'call:offer',
        callId: ringing.callId,
        sdp: offerSdp,
      })
    )

    // Device receives offer
    const deviceOffer = await waitForMessage<{
      type: string
      callId: string
      sdp: string
    }>(deviceWs)
    expect(deviceOffer.type).toBe('call:offer')
    expect(deviceOffer.sdp).toBe(offerSdp)

    // Device sends answer
    const answerSdp = 'mock-answer-sdp'
    deviceWs.send(
      JSON.stringify({
        type: 'call:answer',
        callId: ringing.callId,
        sdp: answerSdp,
      })
    )

    // User receives answer
    const userAnswer = await waitForMessage<{
      type: string
      callId: string
      sdp: string
    }>(userWs)
    expect(userAnswer.type).toBe('call:answer')
    expect(userAnswer.sdp).toBe(answerSdp)

    // ICE candidate from user to device
    const iceCandidate = { candidate: 'mock-candidate', sdpMid: '0', sdpMLineIndex: 0 }
    userWs.send(
      JSON.stringify({
        type: 'call:ice-candidate',
        callId: ringing.callId,
        candidate: iceCandidate,
      })
    )

    const deviceIce = await waitForMessage<{
      type: string
      callId: string
      candidate: { candidate: string; sdpMid: string | null; sdpMLineIndex: number | null }
    }>(deviceWs)
    expect(deviceIce.type).toBe('call:ice-candidate')
    expect(deviceIce.candidate.candidate).toBe('mock-candidate')

    // ICE candidate from device to user
    deviceWs.send(
      JSON.stringify({
        type: 'call:ice-candidate',
        callId: ringing.callId,
        candidate: { candidate: 'device-candidate', sdpMid: '0', sdpMLineIndex: 0 },
      })
    )

    const userIce = await waitForMessage<{
      type: string
      callId: string
      candidate: { candidate: string }
    }>(userWs)
    expect(userIce.type).toBe('call:ice-candidate')
    expect(userIce.candidate.candidate).toBe('device-candidate')

    // Verify call status is connected after answer
    const [session] = await db
      .select()
      .from(callSessions)
      .where(eq(callSessions.id, ringing.callId))
    expect(session.status).toBe('connected')
  })

  // -------------------------------------------------------
  // Call end
  // -------------------------------------------------------

  it('call ended by user — device notified, DB session updated', async () => {
    const { user, profile, device, userWs, deviceWs } = await setupCallParticipants()

    userWs.send(
      JSON.stringify({
        type: 'call:initiate',
        callId: crypto.randomUUID(),
        deviceId: device.id,
        profileId: profile.id,
      })
    )

    const ringing = await waitForMessage<{ type: string; callId: string }>(userWs)
    await waitForMessage(deviceWs) // call:incoming

    // Device accepts
    deviceWs.send(JSON.stringify({ type: 'call:accepted', callId: ringing.callId }))
    await waitForMessage(userWs) // call:accepted

    // User ends call
    userWs.send(
      JSON.stringify({
        type: 'call:ended',
        callId: ringing.callId,
        reason: 'completed',
      })
    )

    // Device receives call:ended
    const ended = await waitForMessage<{
      type: string
      callId: string
      reason: string
    }>(deviceWs)
    expect(ended.type).toBe('call:ended')
    expect(ended.callId).toBe(ringing.callId)
    expect(ended.reason).toBe('completed')

    // Verify DB session
    const [session] = await db
      .select()
      .from(callSessions)
      .where(eq(callSessions.id, ringing.callId))
    expect(session.status).toBe('ended')
    expect(session.end_reason).toBe('completed')
  })

  it('call ended by device — user notified', async () => {
    const { user, profile, device, userWs, deviceWs } = await setupCallParticipants()

    userWs.send(
      JSON.stringify({
        type: 'call:initiate',
        callId: crypto.randomUUID(),
        deviceId: device.id,
        profileId: profile.id,
      })
    )

    const ringing = await waitForMessage<{ type: string; callId: string }>(userWs)
    await waitForMessage(deviceWs)

    deviceWs.send(JSON.stringify({ type: 'call:accepted', callId: ringing.callId }))
    await waitForMessage(userWs)

    // Device ends call
    deviceWs.send(
      JSON.stringify({
        type: 'call:ended',
        callId: ringing.callId,
        reason: 'cancelled',
      })
    )

    const ended = await waitForMessage<{
      type: string
      callId: string
      reason: string
    }>(userWs)
    expect(ended.type).toBe('call:ended')
    expect(ended.reason).toBe('cancelled')
  })

  // -------------------------------------------------------
  // Ring timeout
  // -------------------------------------------------------

  it('ring timeout — call auto-ends with missed reason', async () => {
    // Use fake timers to control the ring timeout (default 30s)
    vi.useFakeTimers({ shouldAdvanceTime: true })

    const { user, profile, device, userWs, deviceWs } = await setupCallParticipants()

    userWs.send(
      JSON.stringify({
        type: 'call:initiate',
        callId: crypto.randomUUID(),
        deviceId: device.id,
        profileId: profile.id,
      })
    )

    const ringing = await waitForMessage<{ type: string; callId: string }>(userWs)
    await waitForMessage(deviceWs) // call:incoming

    // Advance time past RING_TIMEOUT_MS (30s)
    vi.advanceTimersByTime(31_000)

    // Wait for async handlers to complete
    await new Promise((r) => setTimeout(r, 100))

    // User should receive call:ended with reason 'missed'
    const missed = await waitForMessage<{
      type: string
      callId: string
      reason: string
    }>(userWs, 3000)
    expect(missed.type).toBe('call:ended')
    expect(missed.callId).toBe(ringing.callId)
    expect(missed.reason).toBe('missed')

    // Verify DB
    const [session] = await db
      .select()
      .from(callSessions)
      .where(eq(callSessions.id, ringing.callId))
    expect(session.status).toBe('ended')
    expect(session.end_reason).toBe('missed')
  })
})
