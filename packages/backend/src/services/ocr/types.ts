/**
 * OCR service types for text extraction from images.
 * Supports multiple providers (Google Vision, Tesseract) with a common interface.
 */

export interface OCRService {
  /** Extracts text from an image URL or file path */
  extractText(imagePath: string): Promise<string>
}

export interface OCRConfig {
  provider: 'google' | 'tesseract'
  googleCredentials?: string
  googleProjectId?: string
}
