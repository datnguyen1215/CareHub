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

const sampleMedication = {
  id: 'med-1',
  care_profile_id: 'profile-1',
  name: 'Metformin',
  dosage: '500mg',
  schedule: ['morning', 'evening'],
  status: 'active',
  created_at: new Date(),
  updated_at: new Date(),
}

const BASE = '/api/groups/group-1/profiles/profile-1/medications'

describe('POST /api/groups/:groupId/profiles/:profileId/medications', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns 401 without auth', async () => {
    const res = await request(app).post(BASE).send({ name: 'Metformin' })
    expect(res.status).toBe(401)
  })

  it('returns 400 when name is missing', async () => {
    mockDb.select
      .mockReturnValueOnce(makeSelectChain([adminMembership]))
      .mockReturnValueOnce(makeSelectChain([sampleProfile]))

    const res = await request(app).post(BASE).set('Cookie', makeAuthCookie()).send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('name is required')
  })

  it('creates a medication with name only', async () => {
    const minMed = { ...sampleMedication, dosage: null, schedule: [], status: 'active' }
    mockDb.select
      .mockReturnValueOnce(makeSelectChain([adminMembership]))
      .mockReturnValueOnce(makeSelectChain([sampleProfile]))
    mockDb.insert.mockReturnValueOnce(makeInsertChain([minMed]))

    const res = await request(app)
      .post(BASE)
      .set('Cookie', makeAuthCookie())
      .send({ name: 'Metformin' })

    expect(res.status).toBe(201)
    expect(res.body.name).toBe('Metformin')
    expect(res.body.status).toBe('active')
  })

  it('creates a medication with all fields', async () => {
    mockDb.select
      .mockReturnValueOnce(makeSelectChain([adminMembership]))
      .mockReturnValueOnce(makeSelectChain([sampleProfile]))
    mockDb.insert.mockReturnValueOnce(makeInsertChain([sampleMedication]))

    const res = await request(app)
      .post(BASE)
      .set('Cookie', makeAuthCookie())
      .send({ name: 'Metformin', dosage: '500mg', schedule: ['morning', 'evening'] })

    expect(res.status).toBe(201)
    expect(res.body.dosage).toBe('500mg')
    expect(res.body.schedule).toEqual(['morning', 'evening'])
  })

  it('returns 403 for a non-member', async () => {
    mockDb.select.mockReturnValueOnce(makeSelectChain([]))

    const res = await request(app)
      .post(BASE)
      .set('Cookie', makeAuthCookie('other-user'))
      .send({ name: 'Metformin' })

    expect(res.status).toBe(403)
  })
})

describe('GET /api/groups/:groupId/profiles/:profileId/medications', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns 401 without auth', async () => {
    const res = await request(app).get(BASE)
    expect(res.status).toBe(401)
  })

  it('returns only active medications by default', async () => {
    mockDb.select
      .mockReturnValueOnce(makeSelectChain([adminMembership]))
      .mockReturnValueOnce(makeSelectChain([sampleProfile]))
      .mockReturnValueOnce(makeSelectChainResolvesOnWhere([sampleMedication]))

    const res = await request(app).get(BASE).set('Cookie', makeAuthCookie())

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].status).toBe('active')
  })

  it('returns all medications with include_discontinued=true', async () => {
    const discontinued = { ...sampleMedication, id: 'med-2', status: 'discontinued' }
    mockDb.select
      .mockReturnValueOnce(makeSelectChain([adminMembership]))
      .mockReturnValueOnce(makeSelectChain([sampleProfile]))
      .mockReturnValueOnce(makeSelectChainResolvesOnWhere([sampleMedication, discontinued]))

    const res = await request(app)
      .get(`${BASE}?include_discontinued=true`)
      .set('Cookie', makeAuthCookie())

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
  })

  it('returns 403 for a non-member', async () => {
    mockDb.select.mockReturnValueOnce(makeSelectChain([]))

    const res = await request(app).get(BASE).set('Cookie', makeAuthCookie('other-user'))

    expect(res.status).toBe(403)
  })
})

describe('PATCH /api/groups/:groupId/profiles/:profileId/medications/:id', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns 401 without auth', async () => {
    const res = await request(app).patch(`${BASE}/med-1`).send({ name: 'Updated' })
    expect(res.status).toBe(401)
  })

  it('updates a medication', async () => {
    const updated = { ...sampleMedication, dosage: '1000mg' }
    mockDb.select
      .mockReturnValueOnce(makeSelectChain([adminMembership]))
      .mockReturnValueOnce(makeSelectChain([sampleProfile]))
    mockDb.update.mockReturnValueOnce(makeUpdateChain([updated]))

    const res = await request(app)
      .patch(`${BASE}/med-1`)
      .set('Cookie', makeAuthCookie())
      .send({ dosage: '1000mg' })

    expect(res.status).toBe(200)
    expect(res.body.dosage).toBe('1000mg')
  })

  it('discontinues a medication (PATCH status to discontinued)', async () => {
    const discontinued = { ...sampleMedication, status: 'discontinued' }
    mockDb.select
      .mockReturnValueOnce(makeSelectChain([adminMembership]))
      .mockReturnValueOnce(makeSelectChain([sampleProfile]))
    mockDb.update.mockReturnValueOnce(makeUpdateChain([discontinued]))

    const res = await request(app)
      .patch(`${BASE}/med-1`)
      .set('Cookie', makeAuthCookie())
      .send({ status: 'discontinued' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('discontinued')
  })

  it('returns 404 when medication not found', async () => {
    mockDb.select
      .mockReturnValueOnce(makeSelectChain([adminMembership]))
      .mockReturnValueOnce(makeSelectChain([sampleProfile]))
    mockDb.update.mockReturnValueOnce(makeUpdateChain([]))

    const res = await request(app)
      .patch(`${BASE}/nonexistent`)
      .set('Cookie', makeAuthCookie())
      .send({ dosage: '200mg' })

    expect(res.status).toBe(404)
  })

  it('returns 403 for a non-member', async () => {
    mockDb.select.mockReturnValueOnce(makeSelectChain([]))

    const res = await request(app)
      .patch(`${BASE}/med-1`)
      .set('Cookie', makeAuthCookie('other-user'))
      .send({ dosage: '200mg' })

    expect(res.status).toBe(403)
  })
})

describe('DELETE /api/groups/:groupId/profiles/:profileId/medications/:id', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns 401 without auth', async () => {
    const res = await request(app).delete(`${BASE}/med-1`)
    expect(res.status).toBe(401)
  })

  it('deletes a medication and returns 204', async () => {
    mockDb.select
      .mockReturnValueOnce(makeSelectChain([adminMembership]))
      .mockReturnValueOnce(makeSelectChain([sampleProfile]))
    mockDb.delete.mockReturnValueOnce(makeDeleteChain([sampleMedication]))

    const res = await request(app).delete(`${BASE}/med-1`).set('Cookie', makeAuthCookie())

    expect(res.status).toBe(204)
  })

  it('returns 404 when medication not found', async () => {
    mockDb.select
      .mockReturnValueOnce(makeSelectChain([adminMembership]))
      .mockReturnValueOnce(makeSelectChain([sampleProfile]))
    mockDb.delete.mockReturnValueOnce(makeDeleteChain([]))

    const res = await request(app).delete(`${BASE}/nonexistent`).set('Cookie', makeAuthCookie())

    expect(res.status).toBe(404)
  })

  it('returns 403 for a non-member', async () => {
    mockDb.select.mockReturnValueOnce(makeSelectChain([]))

    const res = await request(app)
      .delete(`${BASE}/med-1`)
      .set('Cookie', makeAuthCookie('other-user'))

    expect(res.status).toBe(403)
  })
})
