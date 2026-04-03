import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { truncateAll } from '../helpers/truncate'
import {
  createTestServer,
  connectWs,
  waitForMessage,
  closeWs,
  makeUserJwt,
} from '../helpers/ws'
import { isDeviceConnected, broadcastToUser, getConnectedUserCount, getConnectedDeviceCount } from '../../src/websocket'
import { createDevice, createUser } from '../factories'

describe('WebSocket Client Registry & Broadcast', () => {
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

  function track(ws: import('ws').WebSocket) {
    sockets.push(ws)
    return ws
  }

  it('user connects from 2 tabs and both receive broadcast messages', async () => {
    const user = await createUser({ email: 'registry-user@example.com' })
    const jwt = makeUserJwt(user.id, user.email)

    const ws1 = track(await connectWs(port, { jwt }))
    const ws2 = track(await connectWs(port, { jwt }))

    // Wait for both connected confirmations
    await waitForMessage(ws1)
    await waitForMessage(ws2)

    // Broadcast to user — both tabs should receive
    const sentCount = broadcastToUser(user.id, { type: 'test:broadcast', value: 42 })
    expect(sentCount).toBe(2)

    const msg1 = await waitForMessage(ws1)
    const msg2 = await waitForMessage(ws2)

    expect(msg1).toEqual({ type: 'test:broadcast', value: 42 })
    expect(msg2).toEqual({ type: 'test:broadcast', value: 42 })
  })

  it('user disconnects 1 tab — other tab still receives messages', async () => {
    const user = await createUser({ email: 'registry-partial@example.com' })
    const jwt = makeUserJwt(user.id, user.email)

    const ws1 = track(await connectWs(port, { jwt }))
    const ws2 = track(await connectWs(port, { jwt }))

    await waitForMessage(ws1)
    await waitForMessage(ws2)

    // Disconnect first tab
    await closeWs(ws1)
    // Remove from tracked sockets to avoid double-close
    sockets.splice(sockets.indexOf(ws1), 1)

    // Small delay for disconnect to process
    await new Promise((r) => setTimeout(r, 100))

    // Broadcast should only reach ws2
    const sentCount = broadcastToUser(user.id, { type: 'test:after-close' })
    expect(sentCount).toBe(1)

    const msg2 = await waitForMessage(ws2)
    expect(msg2).toEqual({ type: 'test:after-close' })
  })

  it('user disconnects all tabs — fully removed from registry', async () => {
    const user = await createUser({ email: 'registry-full-remove@example.com' })
    const jwt = makeUserJwt(user.id, user.email)

    const ws1 = track(await connectWs(port, { jwt }))
    await waitForMessage(ws1)

    await closeWs(ws1)
    sockets.splice(sockets.indexOf(ws1), 1)

    await new Promise((r) => setTimeout(r, 100))

    // Broadcast should reach nobody
    const sentCount = broadcastToUser(user.id, { type: 'test:gone' })
    expect(sentCount).toBe(0)

    expect(getConnectedUserCount()).toBe(0)
  })

  it('device connects and disconnects — registry reflects state', async () => {
    const device = await createDevice({
      device_token: 'registry-device-token',
      name: 'Registry Device',
    })

    const ws = track(await connectWs(port, { token: device.device_token }))
    await waitForMessage(ws)

    expect(isDeviceConnected(device.id)).toBe(true)
    expect(getConnectedDeviceCount()).toBe(1)

    await closeWs(ws)
    sockets.splice(sockets.indexOf(ws), 1)
    await new Promise((r) => setTimeout(r, 100))

    expect(isDeviceConnected(device.id)).toBe(false)
    expect(getConnectedDeviceCount()).toBe(0)
  })
})
