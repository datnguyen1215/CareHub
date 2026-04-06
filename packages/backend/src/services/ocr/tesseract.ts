/**
 * Tesseract.js OCR implementation.
 * Local/offline OCR fallback — slower but works without API key.
 */

import Tesseract from 'tesseract.js'
import type { OCRService } from './types.js'
import { logger } from '../logger.js'

export class TesseractOCR implements OCRService {
  async extractText(imagePath: string): Promise<string> {
    try {
      const result = await Tesseract.recognize(imagePath, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text' && m.progress === 1) {
            logger.debug({ progress: m.progress }, 'Tesseract OCR complete')
          }
        },
      })

      return result.data.text.trim()
    } catch (err) {
      logger.error({ err, imagePath }, 'Tesseract OCR extraction failed')
      throw err
    }
  }
}
