/**
 * Google Cloud Vision OCR implementation.
 * Primary OCR provider — fast and accurate.
 */

import { ImageAnnotatorClient } from '@google-cloud/vision'
import type { OCRService } from './types'
import { logger } from '../logger'

export class GoogleVisionOCR implements OCRService {
  private client: ImageAnnotatorClient

  constructor() {
    // Uses GOOGLE_APPLICATION_CREDENTIALS env var automatically
    this.client = new ImageAnnotatorClient()
  }

  async extractText(imagePath: string): Promise<string> {
    try {
      // Use documentTextDetection for better structured document results
      const [result] = await this.client.documentTextDetection(imagePath)
      const fullText = result.fullTextAnnotation?.text ?? ''

      return fullText.trim()
    } catch (err) {
      logger.error({ err, imagePath }, 'Google Vision OCR extraction failed')
      throw err
    }
  }
}
