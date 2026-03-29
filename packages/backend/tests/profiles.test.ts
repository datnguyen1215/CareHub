import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { createApp } from '../src/app'

// Mock drizzle db
vi.mock('../src/db', () => {
  const mockDb = {
    insert: vi.fn(),
    select: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  }
  return { db: mockDb, pool: {} }
})

import { db } from '../src/db'

const mockDb = db as {
  insert: ReturnType<typeof vi.fn>
  select: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  transaction: ReturnType<typeof vi.fn>
}

const app = createApp()
const JWT_SECRET = 'test-secret'

function makeAuthCookie(userId = 'user-1', email = 'user@example.com') {
  const token = jwt.sign({ userId, email }, JWT_SECRET)
  return `token=${token}`
}

function makeSelectChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  }
}

function makeSelectChainResolvesOnWhere(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
    limit: vi.fn().mockResolvedValue(rows),
  }
}

function makeInsertChain(returning: unknown[]) {
  return {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(returning),
  }
}

function makeUpdateChain(returning: unknown[]) {
  return {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(returning),
  }
}

function makeDeleteChain(returning: unknown[]) {
  return {
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(returning),
  }
}

const adminMembership = {
  user_id: 'user-1',
  group_id: 'group-1',
  role: 'admin',
  created_at: new Date(),
}
const viewerMembership = {
  user_id: 'user-2',
  group_id: 'group-1',
  role: 'viewer',
  created_at: new Date(),
}

const sampleProfile = {
  id: 'profile-1',
  group_id: 'group-1',
  name: 'Grandma Rose',
  avatar_url: null,
  date_of_birth: null,
  relationship: null,
  conditions: [],
  created_at: new Date(),
  updated_at: new Date(),
}

describe('POST /api/groups/:groupId/profiles', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/groups/group-1/profiles')
      .send({ name: 'Grandma Rose' })
    expect(res.status).toBe(401)
  })

  it('returns 400 when name is missing', async () => {
    mockDb.select.mockReturnValueOnce(makeSelectChain([adminMembership]))

    const res = await request(app)
      .post('/api/groups/group-1/profiles')
      .set('Cookie', makeAuthCookie())
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('name is required')
  })

  it('creates a profile with name only', async () => {
    mockDb.select.mockReturnValueOnce(makeSelectChain([adminMembership]))
    mockDb.insert.mockReturnValueOnce(makeInsertChain([sampleProfile]))

    const res = await request(app)
      .post('/api/groups/group-1/profiles')
      .set('Cookie', makeAuthCookie())
      .send({ name: 'Grandma Rose' })

    expect(res.status).toBe(201)
    expect(res.body.id).toBe('profile-1')
    expect(res.body.name).toBe('Grandma Rose')
  })

  it('creates a profile with all fields', async () => {
    const fullProfile = {
      ...sampleProfile,
      date_of_birth: '1940-05-12',
      relationship: 'grandmother',
      conditions: ['diabetes', 'hypertension'],
    }
    mockDb.select.mockReturnValueOnce(makeSelectChain([adminMembership]))
    mockDb.insert.mockReturnValueOnce(makeInsertChain([fullProfile]))

    const res = await request(app)
      .post('/api/groups/group-1/profiles')
      .set('Cookie', makeAuthCookie())
      .send({
        name: 'Grandma Rose',
        date_of_birth: '1940-05-12',
        relationship: 'grandmother',
        conditions: ['diabetes', 'hypertension'],
      })

    expect(res.status).toBe(201)
    expect(res.body.relationship).toBe('grandmother')
    expect(res.body.conditions).toEqual(['diabetes', 'hypertension'])
  })

  it('returns 403 for a non-member', async () => {
    mockDb.select.mockReturnValueOnce(makeSelectChain([]))

    const res = await request(app)
      .post('/api/groups/group-1/profiles')
      .set('Cookie', makeAuthCookie('other-user'))
      .send({ name: 'Grandma Rose' })

    expect(res.status).toBe(403)
  })

  it('returns 403 for a viewer (non-admin)', async () => {
    mockDb.select.mockReturnValueOnce(makeSelectChain([viewerMembership]))

    const res = await request(app)
      .post('/api/groups/group-1/profiles')
      .set('Cookie', makeAuthCookie('user-2'))
      .send({ name: 'Grandma Rose' })

    expect(res.status).toBe(403)
  })
})

describe('GET /api/groups/:groupId/profiles', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/groups/group-1/profiles')
    expect(res.status).toBe(401)
  })

  it('returns list of profiles in the group', async () => {
    const profiles = [sampleProfile, { ...sampleProfile, id: 'profile-2', name: 'Uncle Bob' }]
    mockDb.select
      .mockReturnValueOnce(makeSelectChain([adminMembership]))
      .mockReturnValueOnce(makeSelectChainResolvesOnWhere(profiles))

    const res = await request(app)
      .get('/api/groups/group-1/profiles')
      .set('Cookie', makeAuthCookie())

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body[0].id).toBe('profile-1')
    expect(res.body[1].name).toBe('Uncle Bob')
  })

  it("returns only profiles in the user's group (non-member gets 403)", async () => {
    mockDb.select.mockReturnValueOnce(makeSelectChain([]))

    const res = await request(app)
      .get('/api/groups/group-1/profiles')
      .set('Cookie', makeAuthCookie('other-user'))

    expect(res.status).toBe(403)
  })
})

describe('GET /api/groups/:groupId/profiles/:id', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/groups/group-1/profiles/profile-1')
    expect(res.status).toBe(401)
  })

  it('returns a single profile', async () => {
    mockDb.select
      .mockReturnValueOnce(makeSelectChain([adminMembership]))
      .mockReturnValueOnce(makeSelectChain([sampleProfile]))

    const res = await request(app)
      .get('/api/groups/group-1/profiles/profile-1')
      .set('Cookie', makeAuthCookie())

    expect(res.status).toBe(200)
    expect(res.body.id).toBe('profile-1')
    expect(res.body.name).toBe('Grandma Rose')
  })

  it('returns 404 when profile not found', async () => {
    mockDb.select
      .mockReturnValueOnce(makeSelectChain([adminMembership]))
      .mockReturnValueOnce(makeSelectChain([]))

    const res = await request(app)
      .get('/api/groups/group-1/profiles/nonexistent')
      .set('Cookie', makeAuthCookie())

    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/groups/:groupId/profiles/:id', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .patch('/api/groups/group-1/profiles/profile-1')
      .send({ name: 'Updated' })
    expect(res.status).toBe(401)
  })

  it('updates a profile', async () => {
    const updatedProfile = { ...sampleProfile, name: 'Rose Updated', relationship: 'grandmother' }
    mockDb.select.mockReturnValueOnce(makeSelectChain([adminMembership]))
    mockDb.update.mockReturnValueOnce(makeUpdateChain([updatedProfile]))

    const res = await request(app)
      .patch('/api/groups/group-1/profiles/profile-1')
      .set('Cookie', makeAuthCookie())
      .send({ name: 'Rose Updated', relationship: 'grandmother' })

    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Rose Updated')
    expect(res.body.relationship).toBe('grandmother')
  })

  it('returns 400 when name is empty string', async () => {
    mockDb.select.mockReturnValueOnce(makeSelectChain([adminMembership]))

    const res = await request(app)
      .patch('/api/groups/group-1/profiles/profile-1')
      .set('Cookie', makeAuthCookie())
      .send({ name: '   ' })

    expect(res.status).toBe(400)
  })

  it('returns 403 for a non-member', async () => {
    mockDb.select.mockReturnValueOnce(makeSelectChain([]))

    const res = await request(app)
      .patch('/api/groups/group-1/profiles/profile-1')
      .set('Cookie', makeAuthCookie('other-user'))
      .send({ name: 'Updated' })

    expect(res.status).toBe(403)
  })
})

describe('DELETE /api/groups/:groupId/profiles/:id', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns 401 without auth', async () => {
    const res = await request(app).delete('/api/groups/group-1/profiles/profile-1')
    expect(res.status).toBe(401)
  })

  it('deletes a profile and returns 204', async () => {
    mockDb.select.mockReturnValueOnce(makeSelectChain([adminMembership]))
    mockDb.delete.mockReturnValueOnce(makeDeleteChain([sampleProfile]))

    const res = await request(app)
      .delete('/api/groups/group-1/profiles/profile-1')
      .set('Cookie', makeAuthCookie())

    expect(res.status).toBe(204)
  })

  it('returns 404 when profile not found', async () => {
    mockDb.select.mockReturnValueOnce(makeSelectChain([adminMembership]))
    mockDb.delete.mockReturnValueOnce(makeDeleteChain([]))

    const res = await request(app)
      .delete('/api/groups/group-1/profiles/profile-1')
      .set('Cookie', makeAuthCookie())

    expect(res.status).toBe(404)
  })

  it('returns 403 for a non-member', async () => {
    mockDb.select.mockReturnValueOnce(makeSelectChain([]))

    const res = await request(app)
      .delete('/api/groups/group-1/profiles/profile-1')
      .set('Cookie', makeAuthCookie('other-user'))

    expect(res.status).toBe(403)
  })

  it('returns 403 for a viewer (non-admin)', async () => {
    mockDb.select.mockReturnValueOnce(makeSelectChain([viewerMembership]))

    const res = await request(app)
      .delete('/api/groups/group-1/profiles/profile-1')
      .set('Cookie', makeAuthCookie('user-2'))

    expect(res.status).toBe(403)
  })
})
