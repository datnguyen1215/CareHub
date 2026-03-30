/**
 * Local filesystem storage implementation.
 * Saves files to a configurable directory and serves via Express static middleware.
 */

import { randomUUID } from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import type { StorageService } from './types'

export class LocalStorageService implements StorageService {
  private storagePath: string
  private urlPrefix: string

  constructor(storagePath: string, urlPrefix: string = '/uploads') {
    this.storagePath = storagePath
    this.urlPrefix = urlPrefix
  }

  /** Ensures the storage directory exists */
  async init(): Promise<void> {
    await fs.mkdir(this.storagePath, { recursive: true })
  }

  async upload(file: Buffer, _filename: string, mimeType: string): Promise<string> {
    await this.init()

    // Generate unique filename with proper extension
    const ext = this.getExtension(mimeType)
    const uniqueName = `${randomUUID()}${ext}`
    const filePath = path.join(this.storagePath, uniqueName)

    await fs.writeFile(filePath, file)

    return `${this.urlPrefix}/${uniqueName}`
  }

  async delete(url: string): Promise<void> {
    // Extract filename from URL
    const filename = url.replace(this.urlPrefix + '/', '')
    if (!filename || filename.includes('/') || filename.includes('..')) {
      throw new Error('Invalid file URL')
    }

    const filePath = path.join(this.storagePath, filename)

    try {
      await fs.unlink(filePath)
    } catch (err: unknown) {
      const nodeErr = err as { code?: string }
      // Ignore if file doesn't exist
      if (nodeErr.code !== 'ENOENT') {
        throw err
      }
    }
  }

  private getExtension(mimeType: string): string {
    const extensions: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
    }
    return extensions[mimeType] ?? '.bin'
  }
}
