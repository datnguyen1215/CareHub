import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app'
import {
  makeAuthCookie,
  makeSelectChain,
  makeSelectChainResolvesOnWhere,
  makeInsertChain,
  makeUpdateChain,
  makeDeleteChain,
  type MockDb,
} from './utils'

// Mock drizzle db
vi.mock('../src/db', () => {
  return {
    db: {
      insert: vi.fn(),
      select: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      transaction: vi.fn(),
    },
    pool: {},
  }
})

import { db } from '../src/db'

const mockDb = db as MockDb
const app = createApp()

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
