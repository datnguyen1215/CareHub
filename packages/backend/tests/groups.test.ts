import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app'
import { makeAuthCookie } from './utils'
import { truncateAll } from './helpers/truncate'
import { createUser, createGroup, createGroupMember } from './factories'
import { db } from '../src/db'
import { groups, groupMembers } from '@carehub/shared'
import { eq, and } from 'drizzle-orm'

const app = createApp()

beforeAll(async () => {
  await truncateAll()
})

describe('POST /api/groups', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/groups').send({ name: 'My Family' })
    expect(res.status).toBe(401)
  })

  it('returns 400 when name is missing', async () => {
    const user = await createUser({ email: 'user@example.com' })
    const res = await request(app)
      .post('/api/groups')
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('name is required')
  })

  it('creates a group and assigns creator as admin', async () => {
    const user = await createUser({ email: 'creator@example.com' })

    const res = await request(app)
      .post('/api/groups')
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .send({ name: 'My Family' })

    expect(res.status).toBe(201)
    expect(res.body.id).toBeDefined()
    expect(res.body.name).toBe('My Family')

    // Verify group was created
    const [group] = await db.select().from(groups).where(eq(groups.id, res.body.id))
    expect(group).toBeDefined()
    expect(group.name).toBe('My Family')

    // Verify membership was created with admin role
    const [membership] = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.user_id, user.id), eq(groupMembers.group_id, res.body.id)))
    expect(membership).toBeDefined()
    expect(membership.role).toBe('admin')
  })
})

describe('PATCH /api/groups/:id', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).patch('/api/groups/group-1').send({ name: 'New Name' })
    expect(res.status).toBe(401)
  })

  it('returns 400 when name is missing', async () => {
    const user = await createUser({ email: 'patch-user@example.com' })
    const group = await createGroup({ name: 'Test Group' })
    await createGroupMember({ user_id: user.id, group_id: group.id, role: 'admin' })

    const res = await request(app)
      .patch(`/api/groups/${group.id}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .send({})
    expect(res.status).toBe(400)
  })

  it('renames the group for an admin member', async () => {
    const user = await createUser({ email: 'admin-rename@example.com' })
    const group = await createGroup({ name: 'Old Name' })
    await createGroupMember({ user_id: user.id, group_id: group.id, role: 'admin' })

    const res = await request(app)
      .patch(`/api/groups/${group.id}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .send({ name: 'New Name' })

    expect(res.status).toBe(200)
    expect(res.body.name).toBe('New Name')

    // Verify name was updated in database
    const [updated] = await db.select().from(groups).where(eq(groups.id, group.id))
    expect(updated.name).toBe('New Name')
  })

  it('returns 403 for a non-member', async () => {
    const user = await createUser({ email: 'non-member@example.com' })
    const group = await createGroup({ name: 'Private Group' })

    const res = await request(app)
      .patch(`/api/groups/${group.id}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .send({ name: 'Hacked Name' })

    expect(res.status).toBe(403)
  })

  it('returns 403 for a viewer (non-admin) member', async () => {
    const user = await createUser({ email: 'viewer@example.com' })
    const group = await createGroup({ name: 'Viewer Group' })
    await createGroupMember({ user_id: user.id, group_id: group.id, role: 'viewer' })

    const res = await request(app)
      .patch(`/api/groups/${group.id}`)
      .set('Cookie', makeAuthCookie(user.id, user.email))
      .send({ name: 'New Name' })

    expect(res.status).toBe(403)
  })
})

describe('GET /api/groups', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/groups')
    expect(res.status).toBe(401)
  })

  it('returns only groups the user belongs to', async () => {
    const user = await createUser({ email: 'list-user@example.com' })
    const group1 = await createGroup({ name: 'My Family' })
    const group2 = await createGroup({ name: 'Work Team' })
    const group3 = await createGroup({ name: 'Other Group' })

    // User is member of group1 and group2, but not group3
    await createGroupMember({ user_id: user.id, group_id: group1.id, role: 'admin' })
    await createGroupMember({ user_id: user.id, group_id: group2.id, role: 'viewer' })

    const res = await request(app).get('/api/groups').set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body.map((g: { id: string }) => g.id).sort()).toEqual([group1.id, group2.id].sort())
  })

  it('returns empty array when user has no groups', async () => {
    const user = await createUser({ email: 'no-groups@example.com' })

    const res = await request(app).get('/api/groups').set('Cookie', makeAuthCookie(user.id, user.email))

    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })
})
