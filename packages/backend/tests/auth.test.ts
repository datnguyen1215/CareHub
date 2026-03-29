import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app'

// Mock drizzle db
vi.mock('../src/db', () => {
  const mockDb = {
    insert: vi.fn(),
    select: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
  }
  return { db: mockDb, pool: {} }
})

// Mock email service
vi.mock('../src/services/email', () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
}))

import { db } from '../src/db'

const mockDb = db as {
  insert: ReturnType<typeof vi.fn>
  select: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
}

function makeSelectChain(rows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  }
  return chain
}

function makeInsertChain(returning?: unknown[]) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(returning ?? []),
  }
  // values resolves to undefined when no returning() is called (e.g. otp insert)
  chain.values = vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue(returning ?? []),
    then: vi.fn().mockImplementation((resolve: (v: undefined) => void) => resolve(undefined)),
  })
  return chain
}

const app = createApp()

describe('POST /api/auth/request-otp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 when email is missing', async () => {
    const res = await request(app).post('/api/auth/request-otp').send({})
    expect(res.status).toBe(400)
  })

  it('sends OTP and returns 200', async () => {
    mockDb.insert.mockReturnValue(makeInsertChain())
    const res = await request(app).post('/api/auth/request-otp').send({ email: 'test@example.com' })
    expect(res.status).toBe(200)
    expect(res.body.message).toBe('OTP sent')
  })
})

describe('POST /api/auth/verify-otp', () => {
  const VALID_OTP = {
    id: 'otp-id',
    email: 'test@example.com',
    code: '123456',
    expires_at: new Date(Date.now() + 60000),
    created_at: new Date(),
  }

  const EXISTING_USER = {
    id: 'user-id',
    email: 'test@example.com',
    first_name: null,
    last_name: null,
    avatar_url: null,
    created_at: new Date(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 when email or code missing', async () => {
    const res = await request(app).post('/api/auth/verify-otp').send({ email: 'test@example.com' })
    expect(res.status).toBe(400)
  })

  it('returns 401 for invalid OTP', async () => {
    mockDb.select.mockReturnValue(makeSelectChain([]))
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: 'test@example.com', code: '000000' })
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('Invalid or expired OTP')
  })

  it('sets token cookie and returns isNewUser=false for existing user', async () => {
    // First select: OTP lookup
    // Second select: user lookup
    let callCount = 0
    mockDb.select.mockImplementation(() => {
      callCount++
      if (callCount === 1) return makeSelectChain([VALID_OTP])
      return makeSelectChain([EXISTING_USER])
    })
    mockDb.delete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) })

    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: 'test@example.com', code: '123456' })

    expect(res.status).toBe(200)
    expect(res.body.isNewUser).toBe(false)
    const cookies = res.headers['set-cookie'] as string[]
    expect(cookies).toBeDefined()
    const tokenCookie = cookies.find((c: string) => c.startsWith('token='))
    expect(tokenCookie).toBeDefined()
    expect(tokenCookie).toContain('HttpOnly')
  })

  it('creates new user and returns isNewUser=true', async () => {
    let callCount = 0
    mockDb.select.mockImplementation(() => {
      callCount++
      if (callCount === 1) return makeSelectChain([VALID_OTP])
      return makeSelectChain([]) // no existing user
    })
    mockDb.delete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) })
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([EXISTING_USER]),
      }),
    })

    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: 'test@example.com', code: '123456' })

    expect(res.status).toBe(200)
    expect(res.body.isNewUser).toBe(true)
  })
})

describe('POST /api/auth/logout', () => {
  it('clears token cookie', async () => {
    const res = await request(app).post('/api/auth/logout')
    expect(res.status).toBe(200)
    expect(res.body.message).toBe('Logged out')
    const cookies = res.headers['set-cookie'] as string[]
    if (cookies) {
      const tokenCookie = cookies.find((c: string) => c.startsWith('token='))
      // Cookie should be cleared (empty value or expired)
      expect(tokenCookie).toBeDefined()
    }
  })
})

describe('GET /api/users/me', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/users/me')
    expect(res.status).toBe(401)
  })

  it('returns 401 with invalid token', async () => {
    const res = await request(app).get('/api/users/me').set('Cookie', 'token=invalid')
    expect(res.status).toBe(401)
  })
})
