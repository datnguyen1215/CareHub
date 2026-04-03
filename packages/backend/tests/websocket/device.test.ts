import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { truncateAll } from '../helpers/truncate'
import { createTestServer, connectWs, waitForMessage, closeWs } from '../helpers/ws'
import { createDevice } from '../factories'
import { db } from '../../src/db'
import { devices } from '@carehub/shared'
import { eq } from 'drizzle-orm'

describe('WebSocket Device Heartbeat & Status', () => {
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

  it('device sends heartbeat with battery level — DB updated', async () => {
    const device = await createDevice({
      device_token: 'heartbeat-test-token',
      name: 'Heartbeat Device',
      battery_level: null,
    })

    const ws = track(await connectWs(port, { token: device.device_token }))
    await waitForMessage(ws)

    // Send heartbeat
    ws.send(JSON.stringify({ type: 'heartbeat', payload: { batteryLevel: 85 } }))

    // Wait for processing
    await new Promise((r) => setTimeout(r, 200))

    const [updated] = await db.select().from(devices).where(eq(devices.id, device.id))
    expect(updated.battery_level).toBe(85)
    expect(updated.last_seen_at).not.toBeNull()
  })

  it('device sends heartbeat without battery — only last_seen_at updated', async () => {
    const device = await createDevice({
      device_token: 'heartbeat-no-battery-token',
      name: 'No Battery Device',
      battery_level: 50,
    })

    const ws = track(await connectWs(port, { token: device.device_token }))
    await waitForMessage(ws)

    ws.send(JSON.stringify({ type: 'heartbeat', payload: {} }))

    await new Promise((r) => setTimeout(r, 200))

    const [updated] = await db.select().from(devices).where(eq(devices.id, device.id))
    // Battery should remain unchanged when not provided
    expect(updated.battery_level).toBe(50)
    expect(updated.last_seen_at).not.toBeNull()
  })

  it('device disconnects — status set to offline in DB', async () => {
    const device = await createDevice({
      device_token: 'disconnect-test-token',
      name: 'Disconnect Device',
      status: 'online',
    })

    const ws = track(await connectWs(port, { token: device.device_token }))
    await waitForMessage(ws)

    // Verify online
    const [online] = await db.select().from(devices).where(eq(devices.id, device.id))
    expect(online.status).toBe('online')

    await closeWs(ws)
    sockets.splice(sockets.indexOf(ws), 1)

    // Wait for disconnect handler
    await new Promise((r) => setTimeout(r, 300))

    const [offline] = await db.select().from(devices).where(eq(devices.id, device.id))
    expect(offline.status).toBe('offline')
  })

  it('device sends status_update — DB updated', async () => {
    const device = await createDevice({
      device_token: 'status-update-token',
      name: 'Status Update Device',
      status: 'online',
    })

    const ws = track(await connectWs(port, { token: device.device_token }))
    await waitForMessage(ws)

    ws.send(JSON.stringify({ type: 'status_update', payload: { status: 'offline' } }))

    await new Promise((r) => setTimeout(r, 200))

    const [updated] = await db.select().from(devices).where(eq(devices.id, device.id))
    expect(updated.status).toBe('offline')
  })
})
