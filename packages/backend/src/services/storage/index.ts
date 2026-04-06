/**
 * Storage service factory.
 * Creates the appropriate storage service based on environment configuration.
 */

import path from 'path'
import type { StorageService } from './types.js'
import { LocalStorageService } from './local.js'

export type { StorageService } from './types.js'

const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER ?? 'local'
const UPLOADS_PATH = process.env.UPLOADS_PATH ?? path.join(process.cwd(), 'uploads')
const UPLOADS_URL_PREFIX = process.env.UPLOADS_URL_PREFIX ?? '/uploads'

let storageInstance: StorageService | null = null

/** Returns the configured storage service singleton */
export function getStorageService(): StorageService {
  if (!storageInstance) {
    if (STORAGE_PROVIDER === 'local') {
      storageInstance = new LocalStorageService(UPLOADS_PATH, UPLOADS_URL_PREFIX)
    } else {
      // Future: add S3 support here
      throw new Error(`Unsupported storage provider: ${STORAGE_PROVIDER}`)
    }
  }
  return storageInstance
}

/** For testing: reset the storage instance */
export function resetStorageService(): void {
  storageInstance = null
}

export { LocalStorageService } from './local.js'
