import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app'
import { makeAuthCookie } from './utils'
import { truncateAll } from './helpers/truncate'
import {
  createUser,
  createProfile,
  createDevice,
  createDeviceAccess,
  createDeviceCareProfile,
  createDevicePairingToken,
} from './factories'
import { db } from '../src/db'
import { devices, deviceAccess, deviceCareProfiles } from '@carehub/shared'
import { eq, and } from 'drizzle-orm'

const app = createApp()

beforeAll(async () => {
  await truncateAll()
})

// ============================================================
// Device Registration (Kiosk endpoints)
// ============================================================

describe('POST /api/devices/register', () => {
  it('registers a new device and returns device token', async () => {
    const res = await request(app).post('/api/devices/register').send({})

    expect(res.status).toBe(201)
    expect(res.body.deviceId).toBeDefined()
    expect(res.body.deviceToken).toBeDefined()
    expect(res.body.name).toMatch(/^Kiosk-/)

    // Verify device was created in database
    const [device] = await db.select().from(devices).where(eq(devices.id, res.body.deviceId))
    expect(device).toBeDefined()
    expect(device.device_token).toBe(res.body.deviceToken)
  })
})

describe('GET /api/devices/me', () => {
  it('returns 401 without device token', async () => {
    const res = await request(app).get('/api/devices/me')
    expect(res.status).toBe(401)
  })

  it('returns device info with valid token', async () => {
    const device = await createDevice({
      device_token: 'test-device-token-me',
      name: 'Test Kiosk',
      status: 'online',
    })

    const res = await request(app)
      .get('/api/devices/me')
      .set('Authorization', `Bearer ${device.device_token}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(device.id)
    expect(res.body.name).toBe('Test Kiosk')
    expect(res.body.status).toBe('online')
    expect(res.body.profiles).toEqual([])
    expect(res.body.caretakers).toEqual([])
  })

  it('returns assigned profiles and caretakers', async () => {
    const user = await createUser({ email: 'device-me-user@example.com' })
    const profile = await createProfile({ user_id: user.id, name: 'Grandma Rose' })
    const device = await createDevice({
      device_token: 'test-device-token-me-2',
      name: 'Test Kiosk 2',
      paired_at: new Date(),
    })
    await createDeviceAccess({ device_id: device.id, user_id: user.id })
    await createDeviceCareProfile({ device_id: device.id, care_profile_id: profile.id })

    const res = await request(app)
      .get('/api/devices/me')
      .set('Authorization', `Bearer ${device.device_token}`)

    expect(res.status).toBe(200)
    expect(res.body.profiles).toHaveLength(1)
    expect(res.body.profiles[0].id).toBe(profile.id)
    expect(res.body.caretakers).toHaveLength(1)
    expect(res.body.caretakers[0].id).toBe(user.id)
  })
})

describe('POST /api/devices/pairing-token', () => {
  it('returns 401 without device token', async () => {
    const res = await request(app).post('/api/devices/pairing-token')
    expect(res.status).toBe(401)
  })

  it('generates a pairing token', async () => {
    const device = await createDevice({
      device_token: 'test-device-token-pairing',
      name: 'Test Kiosk Pairing',
    })

    const res = await request(app)
      .post('/api/devices/pairing-token')
      .set('Authorization', `Bearer ${device.device_token}`)

    expect(res.status).toBe(201)
    expect(res.body.token).toBeDefined()
    expect(res.body.token).toHaveLength(8) // 4 bytes hex = 8 chars
    expect(res.body.expiresAt).toBeDefined()
  })
})

describe('GET /api/devices/pairing-status', () => {
  it('returns paired=false for unpaired device', async () => {
    const device = await createDevice({
      device_token: 'test-device-token-status-1',
      name: 'Unpaired Kiosk',
    })

    const res = await request(app)
      .get('/api/devices/pairing-status')
      .set('Authorization', `Bearer ${device.device_token}`)

    expect(res.status).toBe(200)
    expect(res.body.paired).toBe(false)
    expect(res.body.pairedAt).toBeNull()
  })

  it('returns paired=true for paired device', async () => {
    const pairedAt = new Date()
    const device = await createDevice({
      device_token: 'test-device-token-status-2',
      name: 'Paired Kiosk',
      paired_at: pairedAt,
    })

    const res = await request(app)
      .get('/api/devices/pairing-status')
      .set('Authorization', `Bearer ${device.device_token}`)

    expect(res.status).toBe(200)
    expect(res.body.paired).toBe(true)
    expect(res.body.pairedAt).toBeDefined()
  })
})

// ============================================================
// Caretaker (Portal) endpoints
// ============================================================

describe('GET /api/devices', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/devices')
    expect(res.status).toBe(401)
  })

  it('returns empty list when user has no devices', async () => {
    const user = await createUser({ email: 'no-devices-user@example.com' })

    const res = await request(app)
      .get('/api/devices')
      .set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(0)
  })

  it('returns devices user has access to with profiles', async () => {
    const user = await createUser({ email: 'devices-list-user@example.com' })
    const profile = await createProfile({ user_id: user.id, name: 'Test Profile' })
    const device = await createDevice({
      device_token: 'list-device-token',
      name: 'Living Room Kiosk',
      status: 'online',
      battery_level: 85,
      paired_at: new Date(),
    })
    await createDeviceAccess({ device_id: device.id, user_id: user.id })
    await createDeviceCareProfile({ device_id: device.id, care_profile_id: profile.id })

    const res = await request(app)
      .get('/api/devices')
      .set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].id).toBe(device.id)
    expect(res.body[0].name).toBe('Living Room Kiosk')
    expect(res.body[0].status).toBe('online')
    expect(res.body[0].battery_level).toBe(85)
    expect(res.body[0].profiles).toHaveLength(1)
    expect(res.body[0].profiles[0].id).toBe(profile.id)
  })

  it('does not return devices user has no access to', async () => {
    const user = await createUser({ email: 'no-access-devices@example.com' })
    const otherUser = await createUser({ email: 'other-devices-owner@example.com' })
    const device = await createDevice({
      device_token: 'other-user-device-token',
      name: 'Other Kiosk',
    })
    await createDeviceAccess({ device_id: device.id, user_id: otherUser.id })

    const res = await request(app)
      .get('/api/devices')
      .set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(0)
  })
})

describe('POST /api/devices/pair', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/devices/pair').send({ token: 'ABC123' })
    expect(res.status).toBe(401)
  })

  it('returns 400 when token is missing', async () => {
    const user = await createUser({ email: 'pair-no-token@example.com' })

    const res = await request(app)
      .post('/api/devices/pair')
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Pairing token is required')
  })

  it('returns 400 for invalid/expired token', async () => {
    const user = await createUser({ email: 'pair-invalid-token@example.com' })

    const res = await request(app)
      .post('/api/devices/pair')
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .send({ token: 'INVALID123' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Invalid or expired pairing token')
  })

  it('pairs device successfully', async () => {
    const user = await createUser({ email: 'pair-success@example.com' })
    const profile = await createProfile({ user_id: user.id, name: 'Pair Test Profile' })
    const device = await createDevice({
      device_token: 'pair-test-device-token',
      name: 'Pair Test Kiosk',
    })
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes from now
    await createDevicePairingToken({ token: 'PAIRTEST', device_id: device.id, expires_at: expiresAt })

    const res = await request(app)
      .post('/api/devices/pair')
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .send({ token: 'pairtest', profileIds: [profile.id] }) // lowercase should work

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(device.id)
    expect(res.body.pairedAt).toBeDefined()
    expect(res.body.profiles).toHaveLength(1)
    expect(res.body.profiles[0].id).toBe(profile.id)

    // Verify user has access to device
    const [access] = await db
      .select()
      .from(deviceAccess)
      .where(and(eq(deviceAccess.device_id, device.id), eq(deviceAccess.user_id, user.id)))
    expect(access).toBeDefined()

    // Verify profile was assigned
    const [assignment] = await db
      .select()
      .from(deviceCareProfiles)
      .where(
        and(eq(deviceCareProfiles.device_id, device.id), eq(deviceCareProfiles.care_profile_id, profile.id))
      )
    expect(assignment).toBeDefined()
  })

  it('rejects expired pairing token', async () => {
    const user = await createUser({ email: 'pair-expired@example.com' })
    const device = await createDevice({
      device_token: 'pair-expired-device-token',
      name: 'Expired Token Kiosk',
    })
    const expiresAt = new Date(Date.now() - 1000) // already expired
    await createDevicePairingToken({ token: 'EXPIRED1', device_id: device.id, expires_at: expiresAt })

    const res = await request(app)
      .post('/api/devices/pair')
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .send({ token: 'EXPIRED1' })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Invalid or expired pairing token')
  })
})

describe('GET /api/devices/:id', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/devices/some-id')
    expect(res.status).toBe(401)
  })

  it('returns 404 for device user has no access to', async () => {
    const user = await createUser({ email: 'get-no-access@example.com' })
    const device = await createDevice({
      device_token: 'get-no-access-device',
      name: 'No Access Kiosk',
    })

    const res = await request(app)
      .get(`/api/devices/${device.id}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(404)
  })

  it('returns device details with profiles', async () => {
    const user = await createUser({ email: 'get-device-detail@example.com' })
    const profile = await createProfile({ user_id: user.id, name: 'Detail Profile' })
    const device = await createDevice({
      device_token: 'get-detail-device',
      name: 'Detail Kiosk',
      status: 'online',
      battery_level: 90,
      paired_at: new Date(),
    })
    await createDeviceAccess({ device_id: device.id, user_id: user.id })
    await createDeviceCareProfile({ device_id: device.id, care_profile_id: profile.id })

    const res = await request(app)
      .get(`/api/devices/${device.id}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(device.id)
    expect(res.body.name).toBe('Detail Kiosk')
    expect(res.body.status).toBe('online')
    expect(res.body.batteryLevel).toBe(90)
    expect(res.body.profiles).toHaveLength(1)
    expect(res.body.profiles[0].id).toBe(profile.id)
  })
})

describe('PATCH /api/devices/:id', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).patch('/api/devices/some-id').send({ name: 'New Name' })
    expect(res.status).toBe(401)
  })

  it('returns 404 for device user has no access to', async () => {
    const user = await createUser({ email: 'patch-no-access@example.com' })
    const device = await createDevice({
      device_token: 'patch-no-access-device',
      name: 'No Access Kiosk',
    })

    const res = await request(app)
      .patch(`/api/devices/${device.id}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .send({ name: 'Updated Name' })

    expect(res.status).toBe(404)
  })

  it('returns 400 when name is missing', async () => {
    const user = await createUser({ email: 'patch-no-name@example.com' })
    const device = await createDevice({
      device_token: 'patch-no-name-device',
      name: 'No Name Kiosk',
    })
    await createDeviceAccess({ device_id: device.id, user_id: user.id })

    const res = await request(app)
      .patch(`/api/devices/${device.id}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('name is required')
  })

  it('updates device name', async () => {
    const user = await createUser({ email: 'patch-device@example.com' })
    const device = await createDevice({
      device_token: 'patch-device-token',
      name: 'Old Name',
    })
    await createDeviceAccess({ device_id: device.id, user_id: user.id })

    const res = await request(app)
      .patch(`/api/devices/${device.id}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .send({ name: 'Kitchen Kiosk' })

    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Kitchen Kiosk')

    // Verify in database
    const [updated] = await db.select().from(devices).where(eq(devices.id, device.id))
    expect(updated.name).toBe('Kitchen Kiosk')
  })
})

describe('DELETE /api/devices/:id', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).delete('/api/devices/some-id')
    expect(res.status).toBe(401)
  })

  it('returns 404 for device user has no access to', async () => {
    const user = await createUser({ email: 'delete-no-access@example.com' })
    const device = await createDevice({
      device_token: 'delete-no-access-device',
      name: 'No Access Kiosk',
    })

    const res = await request(app)
      .delete(`/api/devices/${device.id}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(404)
  })

  it('deletes device and returns 204', async () => {
    const user = await createUser({ email: 'delete-device@example.com' })
    const device = await createDevice({
      device_token: 'delete-device-token',
      name: 'To Delete Kiosk',
    })
    await createDeviceAccess({ device_id: device.id, user_id: user.id })

    const res = await request(app)
      .delete(`/api/devices/${device.id}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(204)

    // Verify device was deleted
    const [deleted] = await db.select().from(devices).where(eq(devices.id, device.id))
    expect(deleted).toBeUndefined()
  })
})

describe('POST /api/devices/:id/profiles', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/devices/some-id/profiles').send({ profileIds: [] })
    expect(res.status).toBe(401)
  })

  it('returns 404 for device user has no access to', async () => {
    const user = await createUser({ email: 'assign-no-access@example.com' })
    const device = await createDevice({
      device_token: 'assign-no-access-device',
      name: 'No Access Kiosk',
    })

    const res = await request(app)
      .post(`/api/devices/${device.id}/profiles`)
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .send({ profileIds: ['some-profile'] })

    expect(res.status).toBe(404)
  })

  it('returns 400 when profileIds is missing', async () => {
    const user = await createUser({ email: 'assign-no-profiles@example.com' })
    const device = await createDevice({
      device_token: 'assign-no-profiles-device',
      name: 'No Profiles Kiosk',
    })
    await createDeviceAccess({ device_id: device.id, user_id: user.id })

    const res = await request(app)
      .post(`/api/devices/${device.id}/profiles`)
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('profileIds array is required')
  })

  it('assigns profiles to device', async () => {
    const user = await createUser({ email: 'assign-profiles@example.com' })
    const profile1 = await createProfile({ user_id: user.id, name: 'Profile 1' })
    const profile2 = await createProfile({ user_id: user.id, name: 'Profile 2' })
    const device = await createDevice({
      device_token: 'assign-profiles-device',
      name: 'Assign Profiles Kiosk',
    })
    await createDeviceAccess({ device_id: device.id, user_id: user.id })

    const res = await request(app)
      .post(`/api/devices/${device.id}/profiles`)
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .send({ profileIds: [profile1.id, profile2.id] })

    expect(res.status).toBe(200)
    expect(res.body.profiles).toHaveLength(2)
    expect(res.body.profiles.map((p: { id: string }) => p.id).sort()).toEqual(
      [profile1.id, profile2.id].sort()
    )
  })

  it('ignores profiles user does not own', async () => {
    const user = await createUser({ email: 'assign-other-profile@example.com' })
    const otherUser = await createUser({ email: 'profile-owner@example.com' })
    const ownProfile = await createProfile({ user_id: user.id, name: 'Own Profile' })
    const otherProfile = await createProfile({ user_id: otherUser.id, name: 'Other Profile' })
    const device = await createDevice({
      device_token: 'assign-other-profile-device',
      name: 'Assign Other Kiosk',
    })
    await createDeviceAccess({ device_id: device.id, user_id: user.id })

    const res = await request(app)
      .post(`/api/devices/${device.id}/profiles`)
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .send({ profileIds: [ownProfile.id, otherProfile.id] })

    expect(res.status).toBe(200)
    expect(res.body.profiles).toHaveLength(1)
    expect(res.body.profiles[0].id).toBe(ownProfile.id)
  })
})

describe('DELETE /api/devices/:id/profiles/:profileId', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).delete('/api/devices/some-id/profiles/some-profile')
    expect(res.status).toBe(401)
  })

  it('returns 404 for device user has no access to', async () => {
    const user = await createUser({ email: 'remove-no-access@example.com' })
    const device = await createDevice({
      device_token: 'remove-no-access-device',
      name: 'No Access Kiosk',
    })

    const res = await request(app)
      .delete(`/api/devices/${device.id}/profiles/some-profile`)
      .set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(404)
  })

  it('removes profile from device', async () => {
    const user = await createUser({ email: 'remove-profile@example.com' })
    const profile = await createProfile({ user_id: user.id, name: 'Remove Profile' })
    const device = await createDevice({
      device_token: 'remove-profile-device',
      name: 'Remove Profile Kiosk',
    })
    await createDeviceAccess({ device_id: device.id, user_id: user.id })
    await createDeviceCareProfile({ device_id: device.id, care_profile_id: profile.id })

    // Verify profile is assigned
    let [assignment] = await db
      .select()
      .from(deviceCareProfiles)
      .where(
        and(eq(deviceCareProfiles.device_id, device.id), eq(deviceCareProfiles.care_profile_id, profile.id))
      )
    expect(assignment).toBeDefined()

    const res = await request(app)
      .delete(`/api/devices/${device.id}/profiles/${profile.id}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(204)

    // Verify profile was removed
    ;[assignment] = await db
      .select()
      .from(deviceCareProfiles)
      .where(
        and(eq(deviceCareProfiles.device_id, device.id), eq(deviceCareProfiles.care_profile_id, profile.id))
      )
    expect(assignment).toBeUndefined()
  })
})
