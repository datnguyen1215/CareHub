import { describe, it, expect, vi, beforeAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { createApp } from '../src/app'
import { truncateAll } from './helpers/truncate'
import { createUser } from './factories'
import { db } from '../src/db'
import { otps } from '@carehub/shared'
import { eq } from 'drizzle-orm'

// Mock email service
vi.mock('../src/services/email', () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
}))

const app = createApp()

beforeAll(async () => {
  await truncateAll()
})

describe('POST /api/auth/request-otp', () => {
  it('returns 400 when email is missing', async () => {
    const res = await request(app).post('/api/auth/request-otp').send({})
    expect(res.status).toBe(400)
  })

  it('sends OTP and returns 200 when no prior OTP exists', async () => {
    const res = await request(app).post('/api/auth/request-otp').send({ email: 'test@example.com' })
    expect(res.status).toBe(200)
    expect(res.body.message).toBe('OTP sent')

    // Verify OTP was created in database
    const otpRecords = await db.select().from(otps).where(eq(otps.email, 'test@example.com'))
    expect(otpRecords.length).toBeGreaterThan(0)
  })

  it('returns 429 when within 60-second cooldown', async () => {
    // Create a recent OTP directly in database to establish cooldown
    await db.insert(otps).values({
      email: 'cooldown@example.com',
      code: '123456',
      expires_at: new Date(Date.now() + 60000),
      created_at: new Date(), // Now - within cooldown window
    })

    // Request should be rate-limited
    const res = await request(app)
      .post('/api/auth/request-otp')
      .send({ email: 'cooldown@example.com' })
    expect(res.status).toBe(429)
    expect(res.body.retryAfter).toBeGreaterThan(0)
    expect(res.body.retryAfter).toBeLessThanOrEqual(60)
  })

  it('sends OTP when cooldown has expired (>60s ago)', async () => {
    // Create an old OTP entry (manually set created_at to be 61 seconds ago)
    const oldDate = new Date(Date.now() - 61_000)
    await db.insert(otps).values({
      email: 'expired@example.com',
      code: '000000',
      expires_at: new Date(Date.now() + 60000),
      created_at: oldDate,
    })

    // Request should succeed since cooldown expired
    const res = await request(app).post('/api/auth/request-otp').send({ email: 'expired@example.com' })
    expect(res.status).toBe(200)
    expect(res.body.message).toBe('OTP sent')
  })
})

describe('POST /api/auth/verify-otp', () => {
  it('returns 400 when email or code missing', async () => {
    const res = await request(app).post('/api/auth/verify-otp').send({ email: 'test@example.com' })
    expect(res.status).toBe(400)
  })

  it('returns 401 for invalid OTP', async () => {
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: 'test@example.com', code: '000000' })
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('Invalid or expired OTP')
  })

  it('sets token cookie and returns isNewUser=false for existing user', async () => {
    // Create existing user
    const user = await createUser({ email: 'existing@example.com' })

    // Create valid OTP
    await db.insert(otps).values({
      email: 'existing@example.com',
      code: '123456',
      expires_at: new Date(Date.now() + 60000),
    })

    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: 'existing@example.com', code: '123456' })

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
    expect(decoded.userId).toBe(user.id)
    expect(decoded.email).toBe('existing@example.com')
  })

  it('creates new user and returns isNewUser=true', async () => {
    // Create valid OTP for new user
    await db.insert(otps).values({
      email: 'newuser@example.com',
      code: '123456',
      expires_at: new Date(Date.now() + 60000),
    })

    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: 'newuser@example.com', code: '123456' })

    expect(res.status).toBe(200)
    expect(res.body.isNewUser).toBe(true)

    const cookies = res.headers['set-cookie'] as string[]
    expect(cookies).toBeDefined()
    const tokenCookie = cookies.find((c: string) => c.startsWith('token='))
    expect(tokenCookie).toBeDefined()
  })

  it('deletes all OTP records for the email on successful verify', async () => {
    // Create multiple OTPs for the same email
    await db.insert(otps).values([
      {
        email: 'multi@example.com',
        code: '111111',
        expires_at: new Date(Date.now() + 60000),
      },
      {
        email: 'multi@example.com',
        code: '222222',
        expires_at: new Date(Date.now() + 60000),
      },
    ])

    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: 'multi@example.com', code: '111111' })

    expect(res.status).toBe(200)

    // Verify all OTPs for this email were deleted
    const remainingOtps = await db.select().from(otps).where(eq(otps.email, 'multi@example.com'))
    expect(remainingOtps).toHaveLength(0)
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
