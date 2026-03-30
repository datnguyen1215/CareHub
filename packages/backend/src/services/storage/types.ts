/**
 * Storage service types for file upload abstraction.
 * Allows easy migration from local storage to S3 or other providers.
 */

export interface StorageService {
  /** Uploads a file and returns the public URL */
  upload(file: Buffer, filename: string, mimeType: string): Promise<string>

  /** Deletes a file by its URL */
  delete(url: string): Promise<void>
}

export interface StorageConfig {
  provider: 'local' | 's3'
  localPath?: string
  localUrlPrefix?: string
}
