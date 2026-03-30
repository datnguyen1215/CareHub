import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app'
import { makeAuthCookie } from './utils'
import { truncateAll } from './helpers/truncate'
import { createUser, createProfile, createProfileShare } from './factories'
import { db } from '../src/db'
import { careProfiles } from '@carehub/shared'
import { eq } from 'drizzle-orm'

const app = createApp()

beforeAll(async () => {
  await truncateAll()
})

describe('POST /api/profiles', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/profiles').send({ name: 'Grandma Rose' })
    expect(res.status).toBe(401)
  })

  it('returns 400 when name is missing', async () => {
    const user = await createUser({ email: 'profile-user@example.com' })

    const res = await request(app)
      .post('/api/profiles')
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('name is required')
  })

  it('creates a profile with name only', async () => {
    const user = await createUser({ email: 'create-profile@example.com' })

    const res = await request(app)
      .post('/api/profiles')
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .send({ name: 'Grandma Rose' })

    expect(res.status).toBe(201)
    expect(res.body.id).toBeDefined()
    expect(res.body.name).toBe('Grandma Rose')

    // Verify profile was created in database with correct user_id
    const [profile] = await db.select().from(careProfiles).where(eq(careProfiles.id, res.body.id))
    expect(profile).toBeDefined()
    expect(profile.name).toBe('Grandma Rose')
    expect(profile.user_id).toBe(user.id)
  })

  it('creates a profile with all fields', async () => {
    const user = await createUser({ email: 'full-profile@example.com' })

    const res = await request(app)
      .post('/api/profiles')
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .send({
        name: 'Grandma Rose',
        date_of_birth: '1940-05-12',
        relationship: 'grandmother',
        conditions: ['diabetes', 'hypertension'],
      })

    expect(res.status).toBe(201)
    expect(res.body.relationship).toBe('grandmother')
    expect(res.body.conditions).toEqual(['diabetes', 'hypertension'])

    // Verify all fields in database
    const [profile] = await db.select().from(careProfiles).where(eq(careProfiles.id, res.body.id))
    expect(profile.relationship).toBe('grandmother')
    expect(profile.conditions).toEqual(['diabetes', 'hypertension'])
  })
})

describe('GET /api/profiles', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/profiles')
    expect(res.status).toBe(401)
  })

  it('returns list of profiles owned by the user', async () => {
    const user = await createUser({ email: 'list-profiles@example.com' })

    const profile1 = await createProfile({ user_id: user.id, name: 'Grandma Rose' })
    const profile2 = await createProfile({ user_id: user.id, name: 'Uncle Bob' })

    const res = await request(app)
      .get('/api/profiles')
      .set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body.map((p: { id: string }) => p.id).sort()).toEqual(
      [profile1.id, profile2.id].sort()
    )
  })

  it("returns only the user's profiles (other users' profiles not visible)", async () => {
    const user = await createUser({ email: 'other-list@example.com' })
    const otherUser = await createUser({ email: 'other-owner@example.com' })

    await createProfile({ user_id: otherUser.id, name: 'Private Profile' })

    const res = await request(app)
      .get('/api/profiles')
      .set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(0)
  })

  it('returns shared profiles along with owned profiles', async () => {
    const owner = await createUser({ email: 'share-owner@example.com' })
    const viewer = await createUser({ email: 'share-viewer@example.com' })

    const ownedProfile = await createProfile({ user_id: viewer.id, name: 'My Profile' })
    const sharedProfile = await createProfile({ user_id: owner.id, name: 'Shared Profile' })
    await createProfileShare({ profile_id: sharedProfile.id, user_id: viewer.id, role: 'viewer' })

    const res = await request(app)
      .get('/api/profiles')
      .set('Cookie', makeAuthCookie(viewer.id, viewer.email))

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body.map((p: { id: string }) => p.id).sort()).toEqual(
      [ownedProfile.id, sharedProfile.id].sort()
    )
  })
})

describe('GET /api/profiles/:id', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/profiles/profile-1')
    expect(res.status).toBe(401)
  })

  it('returns a single profile owned by user', async () => {
    const user = await createUser({ email: 'get-profile@example.com' })
    const profile = await createProfile({ user_id: user.id, name: 'Grandma Rose' })

    const res = await request(app)
      .get(`/api/profiles/${profile.id}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(profile.id)
    expect(res.body.name).toBe('Grandma Rose')
  })

  it('returns 404 when profile not found', async () => {
    const user = await createUser({ email: 'not-found@example.com' })

    // Use a valid UUID that doesn't exist
    const fakeUuid = '00000000-0000-0000-0000-000000000000'
    const res = await request(app)
      .get(`/api/profiles/${fakeUuid}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(404)
  })

  it('returns 404 for profile owned by another user (no access)', async () => {
    const user = await createUser({ email: 'no-access@example.com' })
    const otherUser = await createUser({ email: 'private-owner@example.com' })
    const profile = await createProfile({ user_id: otherUser.id, name: 'Private Profile' })

    const res = await request(app)
      .get(`/api/profiles/${profile.id}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(404)
  })

  it('returns shared profile', async () => {
    const owner = await createUser({ email: 'shared-owner@example.com' })
    const viewer = await createUser({ email: 'shared-viewer@example.com' })
    const profile = await createProfile({ user_id: owner.id, name: 'Shared Profile' })
    await createProfileShare({ profile_id: profile.id, user_id: viewer.id, role: 'viewer' })

    const res = await request(app)
      .get(`/api/profiles/${profile.id}`)
      .set('Cookie', makeAuthCookie(viewer.id, viewer.email))

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(profile.id)
  })
})

describe('PATCH /api/profiles/:id', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).patch('/api/profiles/profile-1').send({ name: 'Updated' })
    expect(res.status).toBe(401)
  })

  it('updates a profile owned by user', async () => {
    const user = await createUser({ email: 'update-profile@example.com' })
    const profile = await createProfile({ user_id: user.id, name: 'Rose' })

    const res = await request(app)
      .patch(`/api/profiles/${profile.id}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .send({ name: 'Rose Updated', relationship: 'grandmother' })

    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Rose Updated')
    expect(res.body.relationship).toBe('grandmother')

    // Verify update in database
    const [updated] = await db.select().from(careProfiles).where(eq(careProfiles.id, profile.id))
    expect(updated.name).toBe('Rose Updated')
    expect(updated.relationship).toBe('grandmother')
  })

  it('returns 400 when name is empty string', async () => {
    const user = await createUser({ email: 'empty-name@example.com' })
    const profile = await createProfile({ user_id: user.id, name: 'Rose' })

    const res = await request(app)
      .patch(`/api/profiles/${profile.id}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .send({ name: '   ' })

    expect(res.status).toBe(400)
  })

  it('returns 403 for non-owner without share', async () => {
    const user = await createUser({ email: 'non-owner-update@example.com' })
    const otherUser = await createUser({ email: 'profile-owner-update@example.com' })
    const profile = await createProfile({ user_id: otherUser.id, name: 'Rose' })

    const res = await request(app)
      .patch(`/api/profiles/${profile.id}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .send({ name: 'Updated' })

    expect(res.status).toBe(403)
  })

  it('returns 403 for viewer (cannot edit)', async () => {
    const owner = await createUser({ email: 'owner-viewer-test@example.com' })
    const viewer = await createUser({ email: 'viewer-edit-test@example.com' })
    const profile = await createProfile({ user_id: owner.id, name: 'Rose' })
    await createProfileShare({ profile_id: profile.id, user_id: viewer.id, role: 'viewer' })

    const res = await request(app)
      .patch(`/api/profiles/${profile.id}`)
      .set('Cookie', makeAuthCookie(viewer.id, viewer.email))
      .send({ name: 'Updated' })

    expect(res.status).toBe(403)
  })

  it('allows admin share to update profile', async () => {
    const owner = await createUser({ email: 'owner-admin-test@example.com' })
    const admin = await createUser({ email: 'admin-edit-test@example.com' })
    const profile = await createProfile({ user_id: owner.id, name: 'Rose' })
    await createProfileShare({ profile_id: profile.id, user_id: admin.id, role: 'admin' })

    const res = await request(app)
      .patch(`/api/profiles/${profile.id}`)
      .set('Cookie', makeAuthCookie(admin.id, admin.email))
      .send({ name: 'Updated by Admin' })

    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Updated by Admin')
  })
})

describe('DELETE /api/profiles/:id', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).delete('/api/profiles/profile-1')
    expect(res.status).toBe(401)
  })

  it('deletes a profile and returns 204', async () => {
    const user = await createUser({ email: 'delete-profile@example.com' })
    const profile = await createProfile({ user_id: user.id, name: 'Rose' })

    const res = await request(app)
      .delete(`/api/profiles/${profile.id}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(204)

    // Verify deletion in database
    const [deleted] = await db.select().from(careProfiles).where(eq(careProfiles.id, profile.id))
    expect(deleted).toBeUndefined()
  })

  it('returns 403 for non-owner (only owner can delete)', async () => {
    const user = await createUser({ email: 'non-owner-delete@example.com' })
    const otherUser = await createUser({ email: 'profile-owner-delete@example.com' })
    const profile = await createProfile({ user_id: otherUser.id, name: 'Rose' })

    const res = await request(app)
      .delete(`/api/profiles/${profile.id}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(403)
  })

  it('returns 403 for admin share (only owner can delete)', async () => {
    const owner = await createUser({ email: 'owner-delete-admin@example.com' })
    const admin = await createUser({ email: 'admin-delete-test@example.com' })
    const profile = await createProfile({ user_id: owner.id, name: 'Rose' })
    await createProfileShare({ profile_id: profile.id, user_id: admin.id, role: 'admin' })

    const res = await request(app)
      .delete(`/api/profiles/${profile.id}`)
      .set('Cookie', makeAuthCookie(admin.id, admin.email))

    expect(res.status).toBe(403)
  })
})
