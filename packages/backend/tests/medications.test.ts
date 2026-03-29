import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app'
import { makeAuthCookie } from './utils'
import { truncateAll } from './helpers/truncate'
import { createUser, createGroup, createGroupMember, createProfile, createMedication } from './factories'
import { db } from '../src/db'
import { medications } from '@carehub/shared'
import { eq } from 'drizzle-orm'

const app = createApp()

beforeAll(async () => {
  await truncateAll()
})

describe('POST /api/groups/:groupId/profiles/:profileId/medications', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/groups/group-1/profiles/profile-1/medications')
      .send({ name: 'Metformin' })
    expect(res.status).toBe(401)
  })

  it('returns 400 when name is missing', async () => {
    const user = await createUser({ email: 'med-user@example.com' })
    const group = await createGroup({ name: 'Family' })
    await createGroupMember({ user_id: user.id, group_id: group.id, role: 'admin' })
    const profile = await createProfile({ group_id: group.id, name: 'Rose' })

    const res = await request(app)
      .post(`/api/groups/${group.id}/profiles/${profile.id}/medications`)
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('name is required')
  })

  it('creates a medication with name only', async () => {
    const user = await createUser({ email: 'create-med@example.com' })
    const group = await createGroup({ name: 'Family' })
    await createGroupMember({ user_id: user.id, group_id: group.id, role: 'admin' })
    const profile = await createProfile({ group_id: group.id, name: 'Rose' })

    const res = await request(app)
      .post(`/api/groups/${group.id}/profiles/${profile.id}/medications`)
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .send({ name: 'Metformin' })

    expect(res.status).toBe(201)
    expect(res.body.name).toBe('Metformin')
    expect(res.body.status).toBe('active')

    // Verify medication in database
    const [med] = await db.select().from(medications).where(eq(medications.id, res.body.id))
    expect(med).toBeDefined()
    expect(med.name).toBe('Metformin')
    expect(med.care_profile_id).toBe(profile.id)
  })

  it('creates a medication with all fields', async () => {
    const user = await createUser({ email: 'full-med@example.com' })
    const group = await createGroup({ name: 'Family' })
    await createGroupMember({ user_id: user.id, group_id: group.id, role: 'admin' })
    const profile = await createProfile({ group_id: group.id, name: 'Rose' })

    const res = await request(app)
      .post(`/api/groups/${group.id}/profiles/${profile.id}/medications`)
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .send({ name: 'Metformin', dosage: '500mg', schedule: ['morning', 'evening'] })

    expect(res.status).toBe(201)
    expect(res.body.dosage).toBe('500mg')
    expect(res.body.schedule).toEqual(['morning', 'evening'])

    // Verify all fields in database
    const [med] = await db.select().from(medications).where(eq(medications.id, res.body.id))
    expect(med.dosage).toBe('500mg')
    expect(med.schedule).toEqual(['morning', 'evening'])
  })

  it('returns 403 for a non-member', async () => {
    const user = await createUser({ email: 'non-member-med@example.com' })
    const group = await createGroup({ name: 'Private' })
    const profile = await createProfile({ group_id: group.id, name: 'Rose' })

    const res = await request(app)
      .post(`/api/groups/${group.id}/profiles/${profile.id}/medications`)
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .send({ name: 'Metformin' })

    expect(res.status).toBe(403)
  })
})

describe('GET /api/groups/:groupId/profiles/:profileId/medications', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/groups/group-1/profiles/profile-1/medications')
    expect(res.status).toBe(401)
  })

  it('returns only active medications by default', async () => {
    const user = await createUser({ email: 'list-meds@example.com' })
    const group = await createGroup({ name: 'Family' })
    await createGroupMember({ user_id: user.id, group_id: group.id, role: 'admin' })
    const profile = await createProfile({ group_id: group.id, name: 'Rose' })

    await createMedication({
      care_profile_id: profile.id,
      name: 'Active Med',
      status: 'active',
    })
    await createMedication({
      care_profile_id: profile.id,
      name: 'Discontinued Med',
      status: 'discontinued',
    })

    const res = await request(app)
      .get(`/api/groups/${group.id}/profiles/${profile.id}/medications`)
      .set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].status).toBe('active')
  })

  it('returns all medications with include_discontinued=true', async () => {
    const user = await createUser({ email: 'all-meds@example.com' })
    const group = await createGroup({ name: 'Family' })
    await createGroupMember({ user_id: user.id, group_id: group.id, role: 'admin' })
    const profile = await createProfile({ group_id: group.id, name: 'Rose' })

    await createMedication({ care_profile_id: profile.id, name: 'Med1', status: 'active' })
    await createMedication({ care_profile_id: profile.id, name: 'Med2', status: 'discontinued' })

    const res = await request(app)
      .get(`/api/groups/${group.id}/profiles/${profile.id}/medications?include_discontinued=true`)
      .set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
  })

  it('returns 403 for a non-member', async () => {
    const user = await createUser({ email: 'list-non-member@example.com' })
    const group = await createGroup({ name: 'Private' })
    const profile = await createProfile({ group_id: group.id, name: 'Rose' })

    const res = await request(app)
      .get(`/api/groups/${group.id}/profiles/${profile.id}/medications`)
      .set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(403)
  })
})

describe('PATCH /api/groups/:groupId/profiles/:profileId/medications/:id', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app)
      .patch('/api/groups/group-1/profiles/profile-1/medications/med-1')
      .send({ name: 'Updated' })
    expect(res.status).toBe(401)
  })

  it('updates a medication', async () => {
    const user = await createUser({ email: 'update-med@example.com' })
    const group = await createGroup({ name: 'Family' })
    await createGroupMember({ user_id: user.id, group_id: group.id, role: 'admin' })
    const profile = await createProfile({ group_id: group.id, name: 'Rose' })
    const med = await createMedication({
      care_profile_id: profile.id,
      name: 'Metformin',
      dosage: '500mg',
    })

    const res = await request(app)
      .patch(`/api/groups/${group.id}/profiles/${profile.id}/medications/${med.id}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .send({ dosage: '1000mg' })

    expect(res.status).toBe(200)
    expect(res.body.dosage).toBe('1000mg')

    // Verify update in database
    const [updated] = await db.select().from(medications).where(eq(medications.id, med.id))
    expect(updated.dosage).toBe('1000mg')
  })

  it('discontinues a medication (PATCH status to discontinued)', async () => {
    const user = await createUser({ email: 'discontinue-med@example.com' })
    const group = await createGroup({ name: 'Family' })
    await createGroupMember({ user_id: user.id, group_id: group.id, role: 'admin' })
    const profile = await createProfile({ group_id: group.id, name: 'Rose' })
    const med = await createMedication({
      care_profile_id: profile.id,
      name: 'Metformin',
      status: 'active',
    })

    const res = await request(app)
      .patch(`/api/groups/${group.id}/profiles/${profile.id}/medications/${med.id}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .send({ status: 'discontinued' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('discontinued')

    // Verify status in database
    const [updated] = await db.select().from(medications).where(eq(medications.id, med.id))
    expect(updated.status).toBe('discontinued')
  })

  it('returns 404 when medication not found', async () => {
    const user = await createUser({ email: 'med-not-found@example.com' })
    const group = await createGroup({ name: 'Family' })
    await createGroupMember({ user_id: user.id, group_id: group.id, role: 'admin' })
    const profile = await createProfile({ group_id: group.id, name: 'Rose' })

    // Use a valid UUID that doesn't exist
    const fakeUuid = '00000000-0000-0000-0000-000000000000'
    const res = await request(app)
      .patch(`/api/groups/${group.id}/profiles/${profile.id}/medications/${fakeUuid}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .send({ dosage: '200mg' })

    expect(res.status).toBe(404)
  })

  it('returns 403 for a non-member', async () => {
    const user = await createUser({ email: 'update-non-member@example.com' })
    const group = await createGroup({ name: 'Private' })
    const profile = await createProfile({ group_id: group.id, name: 'Rose' })
    const med = await createMedication({ care_profile_id: profile.id, name: 'Metformin' })

    const res = await request(app)
      .patch(`/api/groups/${group.id}/profiles/${profile.id}/medications/${med.id}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .send({ dosage: '200mg' })

    expect(res.status).toBe(403)
  })
})

describe('DELETE /api/groups/:groupId/profiles/:profileId/medications/:id', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).delete(
      '/api/groups/group-1/profiles/profile-1/medications/med-1'
    )
    expect(res.status).toBe(401)
  })

  it('deletes a medication and returns 204', async () => {
    const user = await createUser({ email: 'delete-med@example.com' })
    const group = await createGroup({ name: 'Family' })
    await createGroupMember({ user_id: user.id, group_id: group.id, role: 'admin' })
    const profile = await createProfile({ group_id: group.id, name: 'Rose' })
    const med = await createMedication({ care_profile_id: profile.id, name: 'Metformin' })

    const res = await request(app)
      .delete(`/api/groups/${group.id}/profiles/${profile.id}/medications/${med.id}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(204)

    // Verify deletion in database
    const [deleted] = await db.select().from(medications).where(eq(medications.id, med.id))
    expect(deleted).toBeUndefined()
  })

  it('returns 404 when medication not found', async () => {
    const user = await createUser({ email: 'delete-not-found@example.com' })
    const group = await createGroup({ name: 'Family' })
    await createGroupMember({ user_id: user.id, group_id: group.id, role: 'admin' })
    const profile = await createProfile({ group_id: group.id, name: 'Rose' })

    // Use a valid UUID that doesn't exist
    const fakeUuid = '00000000-0000-0000-0000-000000000000'
    const res = await request(app)
      .delete(`/api/groups/${group.id}/profiles/${profile.id}/medications/${fakeUuid}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(404)
  })

  it('returns 403 for a non-member', async () => {
    const user = await createUser({ email: 'delete-non-member@example.com' })
    const group = await createGroup({ name: 'Private' })
    const profile = await createProfile({ group_id: group.id, name: 'Rose' })
    const med = await createMedication({ care_profile_id: profile.id, name: 'Metformin' })

    const res = await request(app)
      .delete(`/api/groups/${group.id}/profiles/${profile.id}/medications/${med.id}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(403)
  })
})
