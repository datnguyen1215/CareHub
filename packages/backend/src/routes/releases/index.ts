/**
 * Release routes — APK upload, latest version query, and download endpoints.
 *
 * Endpoints:
 *   POST /api/releases/upload          — Upload an APK file with metadata. Requires user JWT auth.
 *   GET  /api/releases/latest?app=...  — Get latest release for a given app type. Requires user JWT auth.
 *   GET  /api/releases/:id/download    — Download an APK file. Requires device token auth.
 *
 * Upload directory is configurable via RELEASES_DIR env var (default: data/releases/).
 * APKs are stored outside the static web directory to prevent direct URL access.
 */
import { Router, Request, Response, NextFunction } from 'express'
import multer, { MulterError } from 'multer'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { eq, desc } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { appReleases } from '@carehub/shared'
import { requireAuth } from '../../middleware/auth.js'
import { requireDeviceAuth } from '../../middleware/deviceAuth.js'
import { logger } from '../../services/logger.js'
import { env } from '../../config/env.js'

export const releasesRouter = Router()

/** APK zip local file magic bytes: PK\x03\x04 */
const APK_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04])

/**
 * Resolve the upload directory for APK storage.
 * Uses RELEASES_DIR env var if set, otherwise defaults to data/releases/ relative to CWD.
 */
function getReleasesDir(): string {
  const dir = env.RELEASES_DIR || path.join(process.cwd(), 'data', 'releases')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

/**
 * Validate that a buffer starts with APK (ZIP local file) magic bytes.
 * @param {Buffer} buf - File buffer to check
 * @returns {boolean} True if the buffer has APK magic bytes
 */
function isApkBuffer(buf: Buffer): boolean {
  if (buf.length < 4) return false
  return buf.subarray(0, 4).equals(APK_MAGIC)
}

/**
 * Compute SHA-256 hex digest of a buffer.
 * @param {Buffer} buf - File buffer
 * @returns {string} SHA-256 hex string
 */
function sha256(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex')
}

// Configure multer with memory storage for APK uploads.
// 200MB max — APKs are typically 10–80MB but leave room for larger builds.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB
  },
})

/**
 * POST /api/releases/upload
 *
 * Upload an APK release.
 *
 * Request: multipart/form-data
 *   - file    (required) — APK binary. Must start with PK zip magic bytes.
 *   - app     (required) — "kiosk" or "portal"
 *   - version (required) — Semver string, e.g. "1.2.0"
 *   - version_code (required) — Android versionCode integer
 *   - notes   (optional) — Release notes text
 *
 * Response 201: { id, app, version, version_code, file_size, checksum, notes, created_at }
 * Response 400: { error: string } — missing/invalid fields or non-APK file
 * Response 401: { error: "Unauthorized" } — missing or invalid JWT
 * Response 409: { error: string } — duplicate (app, version_code)
 * Response 500: { error: string } — internal server error
 */
releasesRouter.post(
  '/upload',
  requireAuth,
  (req: Request, res: Response, next: NextFunction): void => {
    upload.single('file')(req, res, async (err: unknown) => {
      // Handle multer errors
      if (err) {
        if (err instanceof MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            res.status(400).json({ error: 'File too large. Maximum size is 200MB.' })
            return
          }
          res.status(400).json({ error: err.message })
          return
        }
        logger.error({ err }, 'POST /releases/upload multer error')
        res.status(500).json({ error: 'Failed to process file upload' })
        return
      }

      if (!req.file) {
        res.status(400).json({ error: 'No file provided' })
        return
      }

      // Validate required fields
      const { app, version, version_code, notes } = req.body as {
        app?: string
        version?: string
        version_code?: string
        notes?: string
      }

      if (!app || (app !== 'kiosk' && app !== 'portal')) {
        res.status(400).json({ error: 'app must be "kiosk" or "portal"' })
        return
      }
      if (!version || typeof version !== 'string' || version.trim() === '') {
        res.status(400).json({ error: 'version is required' })
        return
      }
      const versionCodeNum = parseInt(version_code ?? '', 10)
      if (!version_code || isNaN(versionCodeNum) || versionCodeNum <= 0) {
        res.status(400).json({ error: 'version_code must be a positive integer' })
        return
      }

      // Validate APK magic bytes
      if (!isApkBuffer(req.file.buffer)) {
        res.status(400).json({ error: 'Uploaded file is not a valid APK (missing ZIP magic bytes)' })
        return
      }

      // Compute checksum
      const checksum = sha256(req.file.buffer)
      const fileSize = req.file.buffer.length

      // Determine filename and write to disk.
      // A UUID suffix ensures concurrent uploads of the same (app, version_code) write to
      // distinct paths, so a failed DB insert cannot unlink the file written by a racing
      // successful upload.
      const releasesDir = getReleasesDir()
      const safeVersion = version.trim().replace(/[^a-zA-Z0-9._-]/g, '_')
      const uniqueSuffix = crypto.randomUUID()
      const filename = `${app}-${safeVersion}-${versionCodeNum}-${uniqueSuffix}.apk`
      const filePath = path.join(releasesDir, filename)

      try {
        await fs.promises.writeFile(filePath, req.file.buffer)
      } catch (writeErr) {
        logger.error({ err: writeErr }, 'POST /releases/upload failed to write file')
        res.status(500).json({ error: 'Failed to store APK file' })
        return
      }

      // Insert into database
      try {
        const [release] = await db
          .insert(appReleases)
          .values({
            app,
            version: version.trim(),
            version_code: versionCodeNum,
            file_path: filePath,
            file_size: fileSize,
            checksum,
            notes: notes?.trim() || null,
          })
          .returning()

        // Omit file_path from response to avoid leaking internal filesystem paths
        const { file_path: _fp, ...releaseResponse } = release
        res.status(201).json(releaseResponse)
      } catch (dbErr: unknown) {
        // Clean up written file on DB error
        await fs.promises.unlink(filePath).catch(() => {})

        // Check for unique constraint violation (duplicate app + version_code)
        const msg = dbErr instanceof Error ? dbErr.message : ''
        if (msg.includes('app_releases_app_version_code_idx') || msg.includes('unique')) {
          res
            .status(409)
            .json({ error: `A release with version_code ${versionCodeNum} already exists for ${app}` })
          return
        }

        logger.error({ err: dbErr }, 'POST /releases/upload DB error')
        res.status(500).json({ error: 'Failed to save release record' })
      }
    })
  }
)

/**
 * GET /api/releases/latest?app=kiosk|portal
 *
 * Return the latest release (highest version_code) for the given app type.
 *
 * Query params:
 *   - app (required) — "kiosk" or "portal"
 *
 * Response 200: { id, app, version, version_code, file_size, checksum, notes, created_at }
 * Response 400: { error: string } — missing or invalid app param
 * Response 401: { error: "Unauthorized" } — missing or invalid JWT
 * Response 404: { error: "No releases found" } — no releases for the given app
 * Response 500: { error: string } — internal server error
 */
releasesRouter.get('/latest', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const app = req.query.app as string | undefined

  if (!app || (app !== 'kiosk' && app !== 'portal')) {
    res.status(400).json({ error: 'app query param must be "kiosk" or "portal"' })
    return
  }

  try {
    const [release] = await db
      .select()
      .from(appReleases)
      .where(eq(appReleases.app, app))
      .orderBy(desc(appReleases.version_code))
      .limit(1)

    if (!release) {
      res.status(404).json({ error: 'No releases found' })
      return
    }

    // Omit file_path from response to avoid leaking internal filesystem paths
    const { file_path: _fp, ...releaseResponse } = release
    res.json(releaseResponse)
  } catch (err) {
    logger.error({ err }, 'GET /releases/latest error')
    res.status(500).json({ error: 'Failed to fetch latest release' })
  }
})

/**
 * GET /api/releases/:id/download
 *
 * Serve an APK file for download. Requires a valid device token (kiosk-only endpoint).
 *
 * Path params:
 *   - id — UUID of the release record
 *
 * Response 200: APK binary with Content-Type: application/vnd.android.package-archive
 * Response 401: { error: string } — missing or invalid device token
 * Response 404: { error: string } — release not found or file missing on disk
 * Response 500: { error: string } — internal server error
 */
releasesRouter.get(
  '/:id/download',
  requireDeviceAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params['id'] as string

    try {
      const [release] = await db
        .select()
        .from(appReleases)
        .where(eq(appReleases.id, id))
        .limit(1)

      if (!release) {
        res.status(404).json({ error: 'Release not found' })
        return
      }

      // Check file exists on disk before streaming
      if (!fs.existsSync(release.file_path)) {
        logger.error({ releaseId: id, filePath: release.file_path }, 'APK file missing from disk')
        res.status(404).json({ error: 'APK file not found on server' })
        return
      }

      const filename = path.basename(release.file_path)
      res.setHeader('Content-Type', 'application/vnd.android.package-archive')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      res.setHeader('Content-Length', String(release.file_size))

      const stream = fs.createReadStream(release.file_path)
      stream.on('error', (streamErr) => {
        logger.error({ err: streamErr, releaseId: id }, 'GET /releases/:id/download stream error')
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to stream APK file' })
        }
      })
      stream.pipe(res)
    } catch (err) {
      logger.error({ err }, 'GET /releases/:id/download error')
      res.status(500).json({ error: 'Failed to fetch release' })
    }
  }
)
