import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app'

// Mock the DB module so the health route doesn't require a live database in CI
vi.mock('../src/db', () => ({
  db: {
    execute: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
  pool: {},
}))

describe('GET /health', () => {
  const app = createApp()

  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })

  it('returns JSON content-type', async () => {
    const res = await request(app).get('/health')
    expect(res.headers['content-type']).toMatch(/application\/json/)
  })
})
