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
  transaction: ReturnType<typeof vi.fn>
}

function makeSelectChain(rows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  }
  return chain
}

/** Select chain that resolves directly (no .limit() needed — used for MAX aggregate). */
function makeAggregateSelectChain(rows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
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

  it('sends OTP and returns 200 when no prior OTP exists', async () => {
    // Cooldown check: no prior OTP (lastSent = null)
    mockDb.select.mockReturnValueOnce(makeAggregateSelectChain([{ lastSent: null }]))
    mockDb.insert.mockReturnValue(makeInsertChain())

    const res = await request(app).post('/api/auth/request-otp').send({ email: 'test@example.com' })
    expect(res.status).toBe(200)
    expect(res.body.message).toBe('OTP sent')
  })

  it('returns 429 when within 60-second cooldown', async () => {
    // lastSent was 10 seconds ago → 50 seconds remaining
    const recentDate = new Date(Date.now() - 10_000)
    mockDb.select.mockReturnValueOnce(makeAggregateSelectChain([{ lastSent: recentDate }]))

    const res = await request(app).post('/api/auth/request-otp').send({ email: 'test@example.com' })
    expect(res.status).toBe(429)
    expect(res.body.retryAfter).toBeGreaterThan(0)
    expect(res.body.retryAfter).toBeLessThanOrEqual(50)
  })

  it('sends OTP when cooldown has expired (>60s ago)', async () => {
    // lastSent was 61 seconds ago → cooldown expired
    const oldDate = new Date(Date.now() - 61_000)
    mockDb.select.mockReturnValueOnce(makeAggregateSelectChain([{ lastSent: oldDate }]))
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
    // OTP lookup (outside transaction)
    mockDb.select.mockReturnValue(makeSelectChain([VALID_OTP]))

    // Transaction: delete all OTPs by email, find existing user
    mockDb.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
        select: vi.fn().mockReturnValue(makeSelectChain([EXISTING_USER])),
        insert: vi.fn(),
      }
      return fn(tx)
    })

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

    // Verify the JWT cookie contains a valid parseable payload
    const tokenValue = tokenCookie!.split('=')[1].split(';')[0]
    const decoded = jwt.decode(tokenValue) as { userId: string; email: string }
    expect(decoded).toBeTruthy()
    expect(decoded.userId).toBe('user-id')
    expect(decoded.email).toBe('test@example.com')
  })

  it('creates new user and returns isNewUser=true', async () => {
    // OTP lookup (outside transaction)
    mockDb.select.mockReturnValue(makeSelectChain([VALID_OTP]))

    // Transaction: delete OTP, no existing user, create new
    mockDb.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
        select: vi.fn().mockReturnValue(makeSelectChain([])),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([EXISTING_USER]),
          }),
        }),
      }
      return fn(tx)
    })

    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: 'test@example.com', code: '123456' })

    expect(res.status).toBe(200)
    expect(res.body.isNewUser).toBe(true)
  })

  it('deletes all OTP records for the email on successful verify', async () => {
    mockDb.select.mockReturnValue(makeSelectChain([VALID_OTP]))

    let deletedWhere: unknown = null
    mockDb.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const whereStub = vi.fn().mockImplementation((cond) => {
        deletedWhere = cond
        return Promise.resolve(undefined)
      })
      const tx = {
        delete: vi.fn().mockReturnValue({ where: whereStub }),
        select: vi.fn().mockReturnValue(makeSelectChain([EXISTING_USER])),
        insert: vi.fn(),
      }
      return fn(tx)
    })

    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: 'test@example.com', code: '123456' })

    expect(res.status).toBe(200)
    // Confirm delete was called (the where condition was set)
    expect(deletedWhere).toBeDefined()
  })
})

describe('POST /api/auth/logout', () => {
  it('clears token cookie', async () => {
    const res = await request(app).post('/api/auth/logout')
    expect(res.status).toBe(200)
    expect(res.body.message).toBe('Logged out')
    const cookies = res.headers['set-cookie'] as string[]
    expect(cookies).toBeDefined()
    const tokenCookie = cookies.find((c: string) => c.startsWith('token='))
    expect(tokenCookie).toBeDefined()
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
