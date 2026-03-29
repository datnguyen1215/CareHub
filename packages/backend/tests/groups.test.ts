import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app'
import {
  makeAuthCookie,
  makeSelectChain,
  makeSelectChainResolvesOnWhere,
  makeUpdateChain,
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

describe('POST /api/groups', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/groups').send({ name: 'My Family' })
    expect(res.status).toBe(401)
  })

  it('returns 400 when name is missing', async () => {
    const res = await request(app).post('/api/groups').set('Cookie', makeAuthCookie()).send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('name is required')
  })

  it('creates a group and assigns creator as admin', async () => {
    const createdGroup = { id: 'group-1', name: 'My Family', created_at: new Date() }

    mockDb.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        insert: vi.fn().mockImplementation(() => ({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([createdGroup]),
            then: vi
              .fn()
              .mockImplementation((resolve: (v: undefined) => void) => resolve(undefined)),
          }),
        })),
      }
      return fn(tx)
    })

    const res = await request(app)
      .post('/api/groups')
      .set('Cookie', makeAuthCookie())
      .send({ name: 'My Family' })

    expect(res.status).toBe(201)
    expect(res.body.id).toBe('group-1')
    expect(res.body.name).toBe('My Family')
    // Verify transaction was used (group + member inserted together)
    expect(mockDb.transaction).toHaveBeenCalledOnce()
  })
})

describe('PATCH /api/groups/:id', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).patch('/api/groups/group-1').send({ name: 'New Name' })
    expect(res.status).toBe(401)
  })

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .patch('/api/groups/group-1')
      .set('Cookie', makeAuthCookie())
      .send({})
    expect(res.status).toBe(400)
  })

  it('renames the group for an admin member', async () => {
    const membership = {
      user_id: 'user-1',
      group_id: 'group-1',
      role: 'admin',
      created_at: new Date(),
    }
    const updatedGroup = { id: 'group-1', name: 'New Name', created_at: new Date() }

    // membership lookup
    mockDb.select.mockReturnValueOnce(makeSelectChain([membership]))
    // update
    mockDb.update.mockReturnValueOnce(makeUpdateChain([updatedGroup]))

    const res = await request(app)
      .patch('/api/groups/group-1')
      .set('Cookie', makeAuthCookie())
      .send({ name: 'New Name' })

    expect(res.status).toBe(200)
    expect(res.body.name).toBe('New Name')
  })

  it('returns 403 for a non-member', async () => {
    // No membership found
    mockDb.select.mockReturnValueOnce(makeSelectChain([]))

    const res = await request(app)
      .patch('/api/groups/group-1')
      .set('Cookie', makeAuthCookie('other-user'))
      .send({ name: 'Hacked Name' })

    expect(res.status).toBe(403)
  })

  it('returns 403 for a viewer (non-admin) member', async () => {
    const membership = {
      user_id: 'user-2',
      group_id: 'group-1',
      role: 'viewer',
      created_at: new Date(),
    }

    mockDb.select.mockReturnValueOnce(makeSelectChain([membership]))

    const res = await request(app)
      .patch('/api/groups/group-1')
      .set('Cookie', makeAuthCookie('user-2'))
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
    const rows = [
      { group: { id: 'group-1', name: 'My Family', created_at: new Date() } },
      { group: { id: 'group-2', name: 'Work Team', created_at: new Date() } },
    ]

    mockDb.select.mockReturnValueOnce(makeSelectChainResolvesOnWhere(rows))

    const res = await request(app).get('/api/groups').set('Cookie', makeAuthCookie())

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body[0].id).toBe('group-1')
    expect(res.body[1].id).toBe('group-2')
  })

  it('returns empty array when user has no groups', async () => {
    mockDb.select.mockReturnValueOnce(makeSelectChainResolvesOnWhere([]))

    const res = await request(app).get('/api/groups').set('Cookie', makeAuthCookie())

    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })
})
