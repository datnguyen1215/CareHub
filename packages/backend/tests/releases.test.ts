/**
 * Tests for release upload, query, and download endpoints.
 *
 * POST /api/releases/upload       — upload APK with metadata
 * GET  /api/releases/latest       — get latest release by version_code
 * GET  /api/releases/:id/download — serve APK binary (device auth)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import path from 'path'
import os from 'os'
import fs from 'fs'
import { createApp } from '../src/app'
import { makeAuthCookie } from './utils'
import { truncateAll } from './helpers/truncate'
import { createDevice, createRelease } from './factories'

const app = createApp()

// Use a temp dir for APK storage during tests
const testReleasesDir = path.join(os.tmpdir(), `carehub-test-releases-${Date.now()}`)

beforeAll(async () => {
  process.env.RELEASES_DIR = testReleasesDir
  fs.mkdirSync(testReleasesDir, { recursive: true })
  await truncateAll()
})

afterAll(() => {
  // Clean up temp APK files written during tests
  fs.rmSync(testReleasesDir, { recursive: true, force: true })
  delete process.env.RELEASES_DIR
})

// Minimal valid APK buffer: starts with PK\x03\x04 zip magic bytes
function makeApkBuffer(size = 100): Buffer {
  const buf = Buffer.alloc(size, 0)
  buf[0] = 0x50
  buf[1] = 0x4b
  buf[2] = 0x03
  buf[3] = 0x04
  return buf
}

// ============================================================
// POST /api/releases/upload
// ============================================================

describe('POST /api/releases/upload', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/releases/upload')
      .attach('file', makeApkBuffer(), { filename: 'test.apk', contentType: 'application/octet-stream' })
      .field('app', 'kiosk')
      .field('version', '1.0.0')
      .field('version_code', '1')

    expect(res.status).toBe(401)
  })

  it('uploads a valid APK and returns 201 with release metadata', async () => {
    const res = await request(app)
      .post('/api/releases/upload')
      .set('Cookie', makeAuthCookie())
      .attach('file', makeApkBuffer(), { filename: 'kiosk-1.0.0.apk', contentType: 'application/octet-stream' })
      .field('app', 'kiosk')
      .field('version', '1.0.0')
      .field('version_code', '100')
      .field('notes', 'Initial release')

    expect(res.status).toBe(201)
    expect(res.body.id).toBeDefined()
    expect(res.body.app).toBe('kiosk')
    expect(res.body.version).toBe('1.0.0')
    expect(res.body.version_code).toBe(100)
    expect(res.body.checksum).toMatch(/^[a-f0-9]{64}$/)
    expect(res.body.file_size).toBe(100)
    expect(res.body.notes).toBe('Initial release')
    expect(res.body.file_path).toBeDefined()

    // Verify APK file was written to disk
    expect(fs.existsSync(res.body.file_path)).toBe(true)
  })

  it('accepts portal app type', async () => {
    const res = await request(app)
      .post('/api/releases/upload')
      .set('Cookie', makeAuthCookie())
      .attach('file', makeApkBuffer(), { filename: 'portal-1.0.0.apk', contentType: 'application/octet-stream' })
      .field('app', 'portal')
      .field('version', '1.0.0')
      .field('version_code', '100')

    expect(res.status).toBe(201)
    expect(res.body.app).toBe('portal')
  })

  it('returns 400 for non-APK file (missing magic bytes)', async () => {
    const notAnApk = Buffer.from('this is not an apk file at all')
    const res = await request(app)
      .post('/api/releases/upload')
      .set('Cookie', makeAuthCookie())
      .attach('file', notAnApk, { filename: 'evil.txt', contentType: 'application/octet-stream' })
      .field('app', 'kiosk')
      .field('version', '1.0.0')
      .field('version_code', '200')

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('APK')
  })

  it('returns 400 when no file is provided', async () => {
    const res = await request(app)
      .post('/api/releases/upload')
      .set('Cookie', makeAuthCookie())
      .field('app', 'kiosk')
      .field('version', '1.0.0')
      .field('version_code', '300')

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('No file provided')
  })

  it('returns 400 for invalid app value', async () => {
    const res = await request(app)
      .post('/api/releases/upload')
      .set('Cookie', makeAuthCookie())
      .attach('file', makeApkBuffer(), { filename: 'test.apk', contentType: 'application/octet-stream' })
      .field('app', 'invalid-app')
      .field('version', '1.0.0')
      .field('version_code', '400')

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('app')
  })

  it('returns 400 for missing version', async () => {
    const res = await request(app)
      .post('/api/releases/upload')
      .set('Cookie', makeAuthCookie())
      .attach('file', makeApkBuffer(), { filename: 'test.apk', contentType: 'application/octet-stream' })
      .field('app', 'kiosk')
      .field('version_code', '500')

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('version')
  })

  it('returns 400 for missing version_code', async () => {
    const res = await request(app)
      .post('/api/releases/upload')
      .set('Cookie', makeAuthCookie())
      .attach('file', makeApkBuffer(), { filename: 'test.apk', contentType: 'application/octet-stream' })
      .field('app', 'kiosk')
      .field('version', '1.0.0')

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('version_code')
  })

  it('returns 409 for duplicate (app, version_code)', async () => {
    // First upload should succeed
    await request(app)
      .post('/api/releases/upload')
      .set('Cookie', makeAuthCookie())
      .attach('file', makeApkBuffer(), { filename: 'kiosk-dup.apk', contentType: 'application/octet-stream' })
      .field('app', 'kiosk')
      .field('version', '2.0.0')
      .field('version_code', '9001')
      .expect(201)

    // Second with same app + version_code should conflict
    const res = await request(app)
      .post('/api/releases/upload')
      .set('Cookie', makeAuthCookie())
      .attach('file', makeApkBuffer(), { filename: 'kiosk-dup2.apk', contentType: 'application/octet-stream' })
      .field('app', 'kiosk')
      .field('version', '2.0.1')
      .field('version_code', '9001')

    expect(res.status).toBe(409)
  })
})

// ============================================================
// GET /api/releases/latest
// ============================================================

describe('GET /api/releases/latest', () => {
  beforeAll(async () => {
    // Seed releases for latest query tests
    await createRelease({
      app: 'kiosk',
      version: '1.0.0',
      version_code: 10,
      file_path: '/tmp/kiosk-1.0.0.apk',
      file_size: 1024,
      checksum: 'abc123',
    })
    await createRelease({
      app: 'kiosk',
      version: '1.1.0',
      version_code: 20,
      file_path: '/tmp/kiosk-1.1.0.apk',
      file_size: 2048,
      checksum: 'def456',
    })
    await createRelease({
      app: 'portal',
      version: '1.0.0',
      version_code: 10,
      file_path: '/tmp/portal-1.0.0.apk',
      file_size: 3072,
      checksum: 'ghi789',
    })
  })

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/releases/latest?app=kiosk')
    expect(res.status).toBe(401)
  })

  it('returns latest kiosk release (highest version_code)', async () => {
    const res = await request(app)
      .get('/api/releases/latest?app=kiosk')
      .set('Cookie', makeAuthCookie())

    expect(res.status).toBe(200)
    expect(res.body.app).toBe('kiosk')
    expect(res.body.version_code).toBe(20)
    expect(res.body.version).toBe('1.1.0')
  })

  it('returns latest portal release', async () => {
    const res = await request(app)
      .get('/api/releases/latest?app=portal')
      .set('Cookie', makeAuthCookie())

    expect(res.status).toBe(200)
    expect(res.body.app).toBe('portal')
    expect(res.body.version_code).toBe(10)
  })

  it('returns 400 for missing app param', async () => {
    const res = await request(app)
      .get('/api/releases/latest')
      .set('Cookie', makeAuthCookie())

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('app')
  })

  it('returns 400 for invalid app param', async () => {
    const res = await request(app)
      .get('/api/releases/latest?app=unknown')
      .set('Cookie', makeAuthCookie())

    expect(res.status).toBe(400)
  })
})

// ============================================================
// GET /api/releases/:id/download
// ============================================================

describe('GET /api/releases/:id/download', () => {
  let releaseId: string
  let apkFilePath: string

  beforeAll(async () => {
    // Write a real APK file to the temp dir and create a release record
    apkFilePath = path.join(testReleasesDir, 'download-test.apk')
    const apkBuf = makeApkBuffer(256)
    fs.writeFileSync(apkFilePath, apkBuf)

    const release = await createRelease({
      app: 'kiosk',
      version: '3.0.0',
      version_code: 3000,
      file_path: apkFilePath,
      file_size: 256,
      checksum: 'testchecksum',
    })
    releaseId = release.id
  })

  it('returns 401 without device token', async () => {
    const res = await request(app).get(`/api/releases/${releaseId}/download`)
    expect(res.status).toBe(401)
  })

  it('returns 401 with user JWT (not device token)', async () => {
    const res = await request(app)
      .get(`/api/releases/${releaseId}/download`)
      .set('Cookie', makeAuthCookie())

    expect(res.status).toBe(401)
  })

  it('returns 404 for non-existent release', async () => {
    const device = await createDevice({
      device_token: 'download-test-token-404',
      name: 'Download Test Device',
    })

    const res = await request(app)
      .get('/api/releases/00000000-0000-0000-0000-000000000000/download')
      .set('Authorization', `Bearer ${device.device_token}`)

    expect(res.status).toBe(404)
  })

  it('serves APK file with correct content-type for valid device token', async () => {
    const device = await createDevice({
      device_token: 'download-test-token-ok',
      name: 'Download Test Device OK',
    })

    const res = await request(app)
      .get(`/api/releases/${releaseId}/download`)
      .set('Authorization', `Bearer ${device.device_token}`)

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('application/vnd.android.package-archive')
    expect(res.body).toBeDefined()
  })
})
