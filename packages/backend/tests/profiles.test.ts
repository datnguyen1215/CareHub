import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app'
import { makeAuthCookie } from './utils'
import { truncateAll } from './helpers/truncate'
import { createUser, createGroup, createGroupMember, createProfile } from './factories'
import { db } from '../src/db'
import { careProfiles } from '@carehub/shared'
import { eq } from 'drizzle-orm'

const app = createApp()

beforeAll(async () => {
  await truncateAll()
})

describe('POST /api/groups/:groupId/profiles', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/groups/group-1/profiles')
      .send({ name: 'Grandma Rose' })
    expect(res.status).toBe(401)
  })

  it('returns 400 when name is missing', async () => {
    const user = await createUser({ email: 'profile-user@example.com' })
    const group = await createGroup({ name: 'Test Group' })
    await createGroupMember({ user_id: user.id, group_id: group.id, role: 'admin' })

    const res = await request(app)
      .post(`/api/groups/${group.id}/profiles`)
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('name is required')
  })

  it('creates a profile with name only', async () => {
    const user = await createUser({ email: 'create-profile@example.com' })
    const group = await createGroup({ name: 'Family' })
    await createGroupMember({ user_id: user.id, group_id: group.id, role: 'admin' })

    const res = await request(app)
      .post(`/api/groups/${group.id}/profiles`)
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .send({ name: 'Grandma Rose' })

    expect(res.status).toBe(201)
    expect(res.body.id).toBeDefined()
    expect(res.body.name).toBe('Grandma Rose')

    // Verify profile was created in database
    const [profile] = await db.select().from(careProfiles).where(eq(careProfiles.id, res.body.id))
    expect(profile).toBeDefined()
    expect(profile.name).toBe('Grandma Rose')
    expect(profile.group_id).toBe(group.id)
  })

  it('creates a profile with all fields', async () => {
    const user = await createUser({ email: 'full-profile@example.com' })
    const group = await createGroup({ name: 'Family' })
    await createGroupMember({ user_id: user.id, group_id: group.id, role: 'admin' })

    const res = await request(app)
      .post(`/api/groups/${group.id}/profiles`)
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

  it('returns 403 for a non-member', async () => {
    const user = await createUser({ email: 'non-member-profile@example.com' })
    const group = await createGroup({ name: 'Private' })

    const res = await request(app)
      .post(`/api/groups/${group.id}/profiles`)
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .send({ name: 'Grandma Rose' })

    expect(res.status).toBe(403)
  })

  it('returns 403 for a viewer (non-admin)', async () => {
    const user = await createUser({ email: 'viewer-profile@example.com' })
    const group = await createGroup({ name: 'Family' })
    await createGroupMember({ user_id: user.id, group_id: group.id, role: 'viewer' })

    const res = await request(app)
      .post(`/api/groups/${group.id}/profiles`)
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .send({ name: 'Grandma Rose' })

    expect(res.status).toBe(403)
  })
})

describe('GET /api/groups/:groupId/profiles', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/groups/group-1/profiles')
    expect(res.status).toBe(401)
  })

  it('returns list of profiles in the group', async () => {
    const user = await createUser({ email: 'list-profiles@example.com' })
    const group = await createGroup({ name: 'Family' })
    await createGroupMember({ user_id: user.id, group_id: group.id, role: 'admin' })

    const profile1 = await createProfile({ group_id: group.id, name: 'Grandma Rose' })
    const profile2 = await createProfile({ group_id: group.id, name: 'Uncle Bob' })

    const res = await request(app)
      .get(`/api/groups/${group.id}/profiles`)
      .set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body.map((p: { id: string }) => p.id).sort()).toEqual([profile1.id, profile2.id].sort())
  })

  it("returns only profiles in the user's group (non-member gets 403)", async () => {
    const user = await createUser({ email: 'other-list@example.com' })
    const group = await createGroup({ name: 'Private' })

    const res = await request(app)
      .get(`/api/groups/${group.id}/profiles`)
      .set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(403)
  })
})

describe('GET /api/groups/:groupId/profiles/:id', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/groups/group-1/profiles/profile-1')
    expect(res.status).toBe(401)
  })

  it('returns a single profile', async () => {
    const user = await createUser({ email: 'get-profile@example.com' })
    const group = await createGroup({ name: 'Family' })
    await createGroupMember({ user_id: user.id, group_id: group.id, role: 'admin' })
    const profile = await createProfile({ group_id: group.id, name: 'Grandma Rose' })

    const res = await request(app)
      .get(`/api/groups/${group.id}/profiles/${profile.id}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(200)
    expect(res.body.id).toBe(profile.id)
    expect(res.body.name).toBe('Grandma Rose')
  })

  it('returns 404 when profile not found', async () => {
    const user = await createUser({ email: 'not-found@example.com' })
    const group = await createGroup({ name: 'Family' })
    await createGroupMember({ user_id: user.id, group_id: group.id, role: 'admin' })

    // Use a valid UUID that doesn't exist
    const fakeUuid = '00000000-0000-0000-0000-000000000000'
    const res = await request(app)
      .get(`/api/groups/${group.id}/profiles/${fakeUuid}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/groups/:groupId/profiles/:id', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app)
      .patch('/api/groups/group-1/profiles/profile-1')
      .send({ name: 'Updated' })
    expect(res.status).toBe(401)
  })

  it('updates a profile', async () => {
    const user = await createUser({ email: 'update-profile@example.com' })
    const group = await createGroup({ name: 'Family' })
    await createGroupMember({ user_id: user.id, group_id: group.id, role: 'admin' })
    const profile = await createProfile({ group_id: group.id, name: 'Rose' })

    const res = await request(app)
      .patch(`/api/groups/${group.id}/profiles/${profile.id}`)
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
    const group = await createGroup({ name: 'Family' })
    await createGroupMember({ user_id: user.id, group_id: group.id, role: 'admin' })
    const profile = await createProfile({ group_id: group.id, name: 'Rose' })

    const res = await request(app)
      .patch(`/api/groups/${group.id}/profiles/${profile.id}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .send({ name: '   ' })

    expect(res.status).toBe(400)
  })

  it('returns 403 for a non-member', async () => {
    const user = await createUser({ email: 'non-member-update@example.com' })
    const group = await createGroup({ name: 'Private' })
    const profile = await createProfile({ group_id: group.id, name: 'Rose' })

    const res = await request(app)
      .patch(`/api/groups/${group.id}/profiles/${profile.id}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .send({ name: 'Updated' })

    expect(res.status).toBe(403)
  })
})

describe('DELETE /api/groups/:groupId/profiles/:id', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).delete('/api/groups/group-1/profiles/profile-1')
    expect(res.status).toBe(401)
  })

  it('deletes a profile and returns 204', async () => {
    const user = await createUser({ email: 'delete-profile@example.com' })
    const group = await createGroup({ name: 'Family' })
    await createGroupMember({ user_id: user.id, group_id: group.id, role: 'admin' })
    const profile = await createProfile({ group_id: group.id, name: 'Rose' })

    const res = await request(app)
      .delete(`/api/groups/${group.id}/profiles/${profile.id}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(204)

    // Verify deletion in database
    const [deleted] = await db.select().from(careProfiles).where(eq(careProfiles.id, profile.id))
    expect(deleted).toBeUndefined()
  })

  it('returns 404 when profile not found', async () => {
    const user = await createUser({ email: 'delete-not-found@example.com' })
    const group = await createGroup({ name: 'Family' })
    await createGroupMember({ user_id: user.id, group_id: group.id, role: 'admin' })

    // Use a valid UUID that doesn't exist
    const fakeUuid = '00000000-0000-0000-0000-000000000000'
    const res = await request(app)
      .delete(`/api/groups/${group.id}/profiles/${fakeUuid}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(404)
  })

  it('returns 403 for a non-member', async () => {
    const user = await createUser({ email: 'non-member-delete@example.com' })
    const group = await createGroup({ name: 'Private' })
    const profile = await createProfile({ group_id: group.id, name: 'Rose' })

    const res = await request(app)
      .delete(`/api/groups/${group.id}/profiles/${profile.id}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(403)
  })

  it('returns 403 for a viewer (non-admin)', async () => {
    const user = await createUser({ email: 'viewer-delete@example.com' })
    const group = await createGroup({ name: 'Family' })
    await createGroupMember({ user_id: user.id, group_id: group.id, role: 'viewer' })
    const profile = await createProfile({ group_id: group.id, name: 'Rose' })

    const res = await request(app)
      .delete(`/api/groups/${group.id}/profiles/${profile.id}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(403)
  })
})
