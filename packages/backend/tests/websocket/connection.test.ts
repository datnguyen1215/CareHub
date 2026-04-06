import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { truncateAll } from '../helpers/truncate'
import {
  createTestServer,
  connectWs,
  waitForMessage,
  waitForClose,
  closeWs,
  makeUserJwt,
  makeWsTicket,
} from '../helpers/ws'
import { createDevice, createUser } from '../factories'
import { db } from '../../src/db'
import { devices } from '@carehub/shared'
import { eq } from 'drizzle-orm'

describe('WebSocket Connection Authentication', () => {
  const testServer = createTestServer()
  let port: number
  const sockets: import('ws').WebSocket[] = []

  beforeAll(async () => {
    await truncateAll()
    port = await testServer.start()
  })

  afterEach(async () => {
    await Promise.all(sockets.map((s) => closeWs(s)))
    sockets.length = 0
  })

  afterAll(async () => {
    await testServer.close()
  })

  // Helper to track sockets for cleanup
  function track(ws: import('ws').WebSocket) {
    sockets.push(ws)
    return ws
  }

  // -------------------------------------------------------
  // Device token authentication
  // -------------------------------------------------------

  it('device connects with valid token and receives { type: "connected" }', async () => {
    const device = await createDevice({
      device_token: 'conn-test-valid-token',
      name: 'Valid Device',
    })

    const ws = track(await connectWs(port, { token: device.device_token }))

    const msg = await waitForMessage<{ type: string; payload: { deviceId: string } }>(ws)
    expect(msg.type).toBe('connected')
    expect(msg.payload.deviceId).toBe(device.id)

    // Verify device status is online in DB
    const [updated] = await db.select().from(devices).where(eq(devices.id, device.id))
    expect(updated.status).toBe('online')
  })

  it('rejects device with invalid token (close code 4002)', async () => {
    const ws = track(await connectWs(port, { token: 'nonexistent-token' }))
    const close = await waitForClose(ws)
    expect(close.code).toBe(4002)
    expect(close.reason).toBe('Invalid device token')
  })

  // -------------------------------------------------------
  // Ticket-based user authentication (Portal)
  // -------------------------------------------------------

  it('user connects with valid ticket and receives { type: "connected" }', async () => {
    const user = await createUser({ email: 'ws-ticket-user@example.com' })
    const ticket = makeWsTicket(user.id)

    const ws = track(await connectWs(port, { ticket }))

    const msg = await waitForMessage<{ type: string; payload: { userId: string } }>(ws)
    expect(msg.type).toBe('connected')
    expect(msg.payload.userId).toBe(user.id)
  })

  it('rejects user with reused ticket (close code 4004)', async () => {
    const user = await createUser({ email: 'ws-reused-ticket@example.com' })
    const ticket = makeWsTicket(user.id)

    // First connection consumes the ticket (one-time use)
    const ws1 = track(await connectWs(port, { ticket }))
    await waitForMessage(ws1)

    // Second connection with the same ticket should be rejected
    const ws2 = track(await connectWs(port, { ticket }))
    const close = await waitForClose(ws2)
    expect(close.code).toBe(4004)
    expect(close.reason).toBe('Invalid or expired ticket')
  })

  it('rejects user with invalid ticket (close code 4004)', async () => {
    const ws = track(await connectWs(port, { ticket: 'invalid-ticket-string' }))
    const close = await waitForClose(ws)
    expect(close.code).toBe(4004)
    expect(close.reason).toBe('Invalid or expired ticket')
  })

  // -------------------------------------------------------
  // JWT-based user authentication (legacy)
  // -------------------------------------------------------

  it('user connects with valid JWT and receives { type: "connected" }', async () => {
    const user = await createUser({ email: 'ws-jwt-user@example.com' })
    const jwt = makeUserJwt(user.id, user.email)

    const ws = track(await connectWs(port, { jwt }))

    const msg = await waitForMessage<{ type: string; payload: { userId: string } }>(ws)
    expect(msg.type).toBe('connected')
    expect(msg.payload.userId).toBe(user.id)
  })

  it('rejects user with invalid JWT (close code 4003)', async () => {
    const ws = track(await connectWs(port, { jwt: 'invalid.jwt.token' }))
    const close = await waitForClose(ws)
    expect(close.code).toBe(4003)
    expect(close.reason).toBe('Invalid JWT token')
  })

  // -------------------------------------------------------
  // No auth
  // -------------------------------------------------------

  it('rejects connection with no auth params (close code 4001)', async () => {
    const ws = track(await connectWs(port))
    const close = await waitForClose(ws)
    expect(close.code).toBe(4001)
    expect(close.reason).toBe('Authentication required')
  })
})
